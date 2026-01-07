import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import AttendanceCheckbox from './AttendanceCheckbox';
import ManualUpdateModal from './ManualUpdateModal';

interface User {
    userId: string;
    name: string;
    email: string;
    role: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE';
    checkInTime: string | null;
    isLate: boolean;
    lateByMinutes: number | null;
    locationVerified: boolean;
    isManuallyModified: boolean;
    updatedBy: {
        name: string;
        role: string;
    } | null;
    manualUpdatedAt: string | null;
    updateReason: string | null;
}

interface SessionDetails {
    sessionId: string;
    sessionName: string;
    sessionDate: string;
    frequency: string;
    startTime: string;
    endTime: string;
}

interface Pagination {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    limit: number;
}

interface Summary {
    total: number;
    present: number;
    absent: number;
    late: number;
}

interface SessionAttendanceViewProps {
    sessionId: string;
    sessionDate?: string;
    onClose?: () => void;
}

const SessionAttendanceView: React.FC<SessionAttendanceViewProps> = ({
    sessionId,
    sessionDate,
    onClose
}) => {
    const { user } = useAuth();

    // State
    const [users, setUsers] = useState<User[]>([]);
    const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
    const [pagination, setPagination] = useState<Pagination>({
        currentPage: 1,
        totalPages: 1,
        totalUsers: 0,
        limit: 50
    });
    const [summary, setSummary] = useState<Summary>({
        total: 0,
        present: 0,
        absent: 0,
        late: 0
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE'>('ALL');
    const [currentPage, setCurrentPage] = useState(1);

    // Manual update modal
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [newStatus, setNewStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');

    // Permissions
    const canEdit = user?.role === 'CompanyAdmin' || user?.role === 'SuperAdmin' || user?.role === 'PLATFORM_OWNER';

    // Fetch attendance data
    const fetchAttendance = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '50',
                status: statusFilter,
                ...(searchQuery && { search: searchQuery }),
                ...(sessionDate && { sessionDate })
            });

            const response = await api.get(`/attendance/session/${sessionId}/all-users?${params}`);

            setUsers(response.data.users || []);
            setSessionDetails(response.data.sessionDetails || null);
            setPagination(response.data.pagination || {
                currentPage: 1,
                totalPages: 1,
                totalUsers: 0,
                limit: 50
            });
            setSummary(response.data.summary || {
                total: 0,
                present: 0,
                absent: 0,
                late: 0
            });
        } catch (err: any) {
            console.error('Error fetching attendance:', err);
            setError(err.response?.data?.msg || 'Failed to load attendance data');
        } finally {
            setLoading(false);
        }
    };

    // Fetch on mount and when filters change
    useEffect(() => {
        fetchAttendance();
    }, [sessionId, currentPage, statusFilter, sessionDate]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery !== undefined) {
                setCurrentPage(1);
                fetchAttendance();
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Handle checkbox change
    const handleCheckboxChange = (user: User, checked: boolean) => {
        if (!canEdit) return;

        setSelectedUser(user);
        setNewStatus(checked ? 'PRESENT' : 'ABSENT');
        setIsUpdateModalOpen(true);
    };

    // Handle manual update confirmation
    const handleConfirmUpdate = async (reason?: string) => {
        if (!selectedUser) return;

        try {
            await api.put(`/attendance/session/${sessionId}/manual-update`, {
                userId: selectedUser.userId,
                status: newStatus,
                reason,
                ...(sessionDate && { sessionDate })
            });

            // Refresh data
            await fetchAttendance();

            setIsUpdateModalOpen(false);
            setSelectedUser(null);
        } catch (err: any) {
            console.error('Error updating attendance:', err);
            alert(err.response?.data?.msg || 'Failed to update attendance');
        }
    };

    // Format date/time
    const formatDateTime = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Session Attendance
                            </h2>
                            {sessionDetails && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {sessionDetails.sessionName} • {new Date(sessionDetails.sessionDate).toLocaleDateString('en-IN')}
                                </p>
                            )}
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                        )}
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-4 gap-4 mt-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total</p>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summary.total}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">Present</p>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{summary.present}</p>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Late</p>
                            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{summary.late}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">Absent</p>
                            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{summary.absent}</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                    <div className="flex gap-4 items-center">
                        {/* Search */}
                        <div className="flex-1">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                    search
                                </span>
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                                />
                            </div>
                        </div>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as any);
                                setCurrentPage(1);
                            }}
                            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                        >
                            <option value="ALL">All Status</option>
                            <option value="PRESENT">Present</option>
                            <option value="LATE">Late</option>
                            <option value="ABSENT">Absent</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f04129]"></div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
                                <p className="text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <span className="material-symbols-outlined text-6xl text-gray-400 mb-4">people</span>
                                <p className="text-gray-600 dark:text-gray-400">No users found</p>
                            </div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Check-in Time
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Info
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                                {users.map((user) => (
                                    <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <AttendanceCheckbox
                                                user={user}
                                                canEdit={canEdit}
                                                onChange={handleCheckboxChange}
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {user.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        {user.role}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {user.email}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {formatDateTime(user.checkInTime)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col gap-1">
                                                {user.isLate && (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                        Late by {user.lateByMinutes} min
                                                    </span>
                                                )}
                                                {user.isManuallyModified && user.updatedBy && (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                        Modified by {user.updatedBy.name}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {!loading && !error && pagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.totalUsers)} of {pagination.totalUsers} users
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                                    Page {currentPage} of {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                                    disabled={currentPage === pagination.totalPages}
                                    className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Manual Update Modal */}
            <ManualUpdateModal
                isOpen={isUpdateModalOpen}
                user={selectedUser}
                newStatus={newStatus}
                onConfirm={handleConfirmUpdate}
                onCancel={() => {
                    setIsUpdateModalOpen(false);
                    setSelectedUser(null);
                }}
            />
        </div>
    );
};

export default SessionAttendanceView;
