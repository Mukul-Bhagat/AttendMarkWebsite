import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface OrganizationUserReport {
    userId: string;
    name: string;
    email: string;
    role: string;
    classesInvolved: number;
    totalSessions: number;
    sessionsAttended: number;
    attendancePercentage: number;
    userCreatedOn: string;
}

interface OrganizationUsersReportResponse {
    metadata: {
        organizationId: string;
        dateRange: { start: string; end: string };
        totalUsers: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    users: OrganizationUserReport[];
}

// ============================================
// ORGANIZATION USERS REPORT (PRIMARY VIEW)
// ============================================

const OrganizationUsersReport: React.FC = () => {
    const navigate = useNavigate();

    // State
    const [data, setData] = useState<OrganizationUsersReportResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>('');

    // Filters
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'attendancePercentage'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Date range (default: last 30 days)
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError('');

            try {
                const params = new URLSearchParams({
                    startDate,
                    endDate,
                    page: page.toString(),
                    limit: '20',
                    sortBy,
                    sortOrder
                });

                if (search.trim()) {
                    params.append('search', search.trim());
                }

                const { data: response } = await api.get<OrganizationUsersReportResponse>(
                    `/api/reports/organization/users?${params.toString()}`
                );

                setData(response);
            } catch (err: any) {
                console.error('Error fetching organization users report:', err);
                setError(err.response?.data?.msg || 'Failed to load attendance report');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [page, startDate, endDate, sortBy, sortOrder, search]);

    // Handlers
    const handleUserClick = (userId: string) => {
        navigate(`/admin/attendance/users/${userId}`);
    };

    const handleSort = (field: 'name' | 'attendancePercentage') => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    const getAttendanceColor = (percentage: number) => {
        if (percentage >= 90) return 'text-green-600 dark:text-green-400';
        if (percentage >= 75) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header skeleton */}
                    <div className="mb-8">
                        <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                        <div className="h-5 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>

                    {/* Filters skeleton */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                            ))}
                        </div>
                    </div>

                    {/* Table skeleton */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
                        <div className="p-6 space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
                            <div>
                                <h3 className="text-red-900 dark:text-red-200 font-semibold">Error Loading Report</h3>
                                <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Empty state
    if (data && data.users.length === 0) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <header className="mb-8">
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
                            Attendance Report
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400">
                            Organization-wide attendance overview
                        </p>
                    </header>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center shadow-sm">
                        <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4 block">
                            people_outline
                        </span>
                        <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            No Users Found
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            {search ? 'Try adjusting your search or filters' : 'No active users in the selected date range'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
                        Attendance Report
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        {data?.metadata.totalUsers || 0} users • {data?.metadata.dateRange.start} to {data?.metadata.dateRange.end}
                    </p>
                </header>

                {/* Filters */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Search */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Search Users
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    search
                                </span>
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                            </div>
                        </div>

                        {/* Start Date */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>

                        {/* End Date */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center gap-2">
                                            User
                                            {sortBy === 'name' && (
                                                <span className="material-symbols-outlined text-sm">
                                                    {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Classes
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Sessions
                                    </th>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        onClick={() => handleSort('attendancePercentage')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Attendance %
                                            {sortBy === 'attendancePercentage' && (
                                                <span className="material-symbols-outlined text-sm">
                                                    {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {data?.users.map((user) => (
                                    <tr
                                        key={user.userId}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                                        onClick={() => handleUserClick(user.userId)}
                                    >
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-slate-900 dark:text-white">
                                                    {user.name}
                                                </div>
                                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                                    {user.email}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                                            {user.classesInvolved}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-700 dark:text-slate-300">
                                                <span className="font-medium">{user.sessionsAttended}</span>
                                                <span className="text-slate-500 dark:text-slate-400">/{user.totalSessions}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-full ${user.attendancePercentage >= 90 ? 'bg-green-500' :
                                                                user.attendancePercentage >= 75 ? 'bg-yellow-500' :
                                                                    'bg-red-500'
                                                            }`}
                                                        style={{ width: `${user.attendancePercentage}%` }}
                                                    ></div>
                                                </div>
                                                <span className={`font-semibold text-sm w-12 text-right ${getAttendanceColor(user.attendancePercentage)}`}>
                                                    {user.attendancePercentage.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUserClick(user.userId);
                                                }}
                                            >
                                                View
                                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {data && data.metadata.totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                                Page {data.metadata.page} of {data.metadata.totalPages}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(data.metadata.totalPages, p + 1))}
                                    disabled={page === data.metadata.totalPages}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrganizationUsersReport;
