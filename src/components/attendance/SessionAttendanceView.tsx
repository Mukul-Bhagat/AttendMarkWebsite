import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import AttendanceCheckbox from './AttendanceCheckbox';
// ❌ DEPRECATED - Keeping for backward compatibility but not using
// import ManualUpdateModal from './ManualUpdateModal';

// ✅ NEW COMPONENTS
import EnhancedManualUpdateModal from './EnhancedManualUpdateModal';
import AttendanceAuditViewer from './AttendanceAuditViewer';
import ManualEditBadge from './ManualEditBadge';

// ✅ PERMISSIONS
import { canAdjustAttendance } from '../../utils/attendancePermissions';

// ✅ API
import { adjustAttendance } from '../../api/attendanceAdjustment';

interface ModificationHistoryEntry {
    modifiedAt: string;
    modifiedBy: {
        userId: string;
        name: string;
        role: string;
    };
    action: string;
    reason: string;
    previousState: {
        status: string;
        markedAt?: string;
        lateMinutes?: number;
    };
    newState: {
        status: string;
        markedAt?: string;
        lateMinutes?: number;
    };
}

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
    modificationHistory?: ModificationHistoryEntry[];
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
    // ✅ AUTH CONTEXT
    const { user: currentUser } = useAuth();

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

    // ✅ NEW: Enhanced modal state
    const [selectedUserForAdjust, setSelectedUserForAdjust] = useState<User | null>(null);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [newStatusForModal, setNewStatusForModal] = useState<'PRESENT' | 'ABSENT' | 'LATE'>('PRESENT');

    // ✅ NEW: Audit viewer state
    const [isAuditViewerOpen, setIsAuditViewerOpen] = useState(false);

    // ❌ DEPRECATED - Old manual update modal state (keeping for backward compat transition)
    // const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    // const [selectedUser, setSelectedUser] = useState<User | null>(null);
    // const [newStatus, setNewStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');

    // Permissions (using new permission system)
    const canEdit = canAdjustAttendance(currentUser);

    // Fetch attendance data
    const fetchAttendance = async () => {
        try {
            setLoading(true);
            setError(null);

            // ✅ NEW: Call /manage endpoint (returns all users with attendance merged)
            // 🔥 CACHE BUSTER: Add timestamp to force fresh request
            // 🔥 CRITICAL: Include targetDate for date-scoped attendance query
            const response = await api.get(`/attendance/session/${sessionId}/manage`, {
                params: {
                    _ts: Date.now(), // Force unique URL to bypass all caches
                    targetDate: sessionDate ? sessionDate.split('T')[0] : undefined // ✅ Send YYYY-MM-DD only
                },
                headers: {
                    'Cache-Control': 'no-store, no-cache',
                    'Pragma': 'no-cache'
                }
            });

            // Response format: { success: true, data: { users: [...], summary: {...}, session: {...} } }
            const responseData = response.data?.data || response.data;

            const allUsers = responseData.users || [];

            // ✅ CLIENT-SIDE FILTERING (instead of server-side)
            let filteredUsers = allUsers;

            // Apply search filter
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                filteredUsers = filteredUsers.filter((user: User) =>
                    user.name.toLowerCase().includes(searchLower) ||
                    user.email.toLowerCase().includes(searchLower)
                );
            }

            // Apply status filter
            if (statusFilter && statusFilter !== 'ALL') {
                filteredUsers = filteredUsers.filter((user: User) => user.status === statusFilter);
            }

            setUsers(filteredUsers);

            // Set session details from response
            setSessionDetails({
                sessionId: responseData.session?.id || sessionId,
                sessionName: responseData.session?.name || 'Session',
                sessionDate: responseData.sessionDate || sessionDate || '',
                frequency: 'OneTime',
                startTime: responseData.session?.startTime || '',
                endTime: responseData.session?.endTime || ''
            });

            // Set summary (use original counts, not filtered)
            setSummary(responseData.summary || {
                total: allUsers.length,
                present: allUsers.filter((u: User) => u.status === 'PRESENT').length,
                absent: allUsers.filter((u: User) => u.status === 'ABSENT').length,
                late: allUsers.filter((u: User) => u.isLate).length
            });

            // Set pagination (client-side, single page with all users)
            setPagination({
                currentPage: 1,
                totalPages: 1,
                totalUsers: filteredUsers.length,
                limit: 1000 // High limit since we're client-side
            });

        } catch (err: any) {
            console.error('Error fetching attendance:', err);
            setError(err.response?.data?.message || err.response?.data?.msg || 'Failed to load attendance data');
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

    // ✅ NEW: Handle checkbox change (triggers adjust modal)
    const handleCheckboxChange = (user: User, checked: boolean) => {
        if (!canEdit) return;

        setSelectedUserForAdjust(user);
        setNewStatusForModal(checked ? 'PRESENT' : 'ABSENT');
        setIsAdjustModalOpen(true);
    };

    // ✅ NEW: Handle adjustment confirmation (uses new API)
    const handleConfirmAdjustment = async (reason: string, lateMinutes?: number) => {
        if (!selectedUserForAdjust) return;

        try {
            await adjustAttendance(sessionId, {
                userId: selectedUserForAdjust.userId,
                newStatus: newStatusForModal,
                reason,
                lateMinutes,
                targetDate: sessionDate
            });

            // 🔥 CRITICAL: Re-fetch from backend (single source of truth)
            await fetchAttendance();

            // Close modal
            setIsAdjustModalOpen(false);
            setSelectedUserForAdjust(null);
        } catch (err: any) {
            console.error('Error adjusting attendance:', err);
            // Error handling is done in the modal via toast
            throw err; // Re-throw so modal can handle it
        }
    };

    // ❌ DEPRECATED - Old manual update (no longer used)
    // const handleConfirmUpdate = async (reason?: string) => {
    //     if (!selectedUser) return;
    //     try {
    //         await api.put(`/attendance/session/${sessionId}/manual-update`, {
    //             userId: selectedUser.userId,
    //             status: newStatus,
    //             reason,
    //             ...(sessionDate && { sessionDate })
    //         });
    //         await fetchAttendance();
    //         setIsUpdateModalOpen(false);
    //         setSelectedUser(null);
    //     } catch (err: any) {
    //         console.error('Error updating attendance:', err);
    //         alert(err.response?.data?.msg || 'Failed to update attendance');
    //     }
    // };

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
                        <div className="flex items-center gap-3">
                            {/* ✅ NEW: Audit Trail Button (Permission-gated) */}
                            {canEdit && (
                                <button
                                    onClick={() => setIsAuditViewerOpen(true)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">history</span>
                                    View Audit Trail
                                </button>
                            )}
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    <span className="material-symbols-outlined text-2xl">close</span>
                                </button>
                            )}
                        </div>
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
                                    {/* ✅ NEW: Actions column for admin */}
                                    {canEdit && (
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    )}
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
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {user.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        {user.role}
                                                    </div>
                                                </div>
                                                {/* ✅ NEW: Manual Edit Badge */}
                                                {user.modificationHistory && user.modificationHistory.length > 0 && (
                                                    <ManualEditBadge
                                                        isModified={true}
                                                        modifiedBy={user.modificationHistory[user.modificationHistory.length - 1]?.modifiedBy}
                                                        modifiedAt={user.modificationHistory[user.modificationHistory.length - 1]?.modifiedAt}
                                                        modificationCount={user.modificationHistory.length}
                                                        onViewHistory={() => {
                                                            setIsAuditViewerOpen(true);
                                                        }}
                                                    />
                                                )}
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
                                        {/* ✅ NEW: Adjust Attendance Button (Permission-gated) */}
                                        {canEdit && (
                                            <td className="px-4 py-4 text-right">
                                                <button
                                                    data-testid="adjust-button"
                                                    onClick={() => {
                                                        setSelectedUserForAdjust(user);
                                                        setNewStatusForModal(user.status === 'ABSENT' ? 'PRESENT' : 'ABSENT');
                                                        setIsAdjustModalOpen(true);
                                                    }}
                                                    className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm font-medium transition-colors"
                                                >
                                                    Adjust
                                                </button>
                                            </td>
                                        )}
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

            {/* ✅ NEW: Enhanced Manual Update Modal */}
            {isAdjustModalOpen && selectedUserForAdjust && (
                <EnhancedManualUpdateModal
                    isOpen={isAdjustModalOpen}
                    user={selectedUserForAdjust}
                    newStatus={newStatusForModal}
                    sessionName={sessionDetails?.sessionName}
                    sessionDate={sessionDate}
                    onConfirm={handleConfirmAdjustment}
                    onCancel={() => {
                        setIsAdjustModalOpen(false);
                        setSelectedUserForAdjust(null);
                    }}
                />
            )}

            {/* ✅ NEW: Attendance Audit Viewer */}
            {isAuditViewerOpen && (
                <AttendanceAuditViewer
                    sessionId={sessionId}
                    sessionName={sessionDetails?.sessionName || 'Session'}
                    sessionDate={sessionDate}
                    isOpen={isAuditViewerOpen}
                    onClose={() => {
                        setIsAuditViewerOpen(false);
                    }}
                />
            )}

            {/* ❌ DEPRECATED: Old Manual Update Modal (removed) */}
            {/* <ManualUpdateModal
                isOpen={isUpdateModalOpen}
                user={selectedUser}
                newStatus={newStatus}
                onConfirm={handleConfirmUpdate}
                onCancel={() => {
                    setIsUpdateModalOpen(false);
                    setSelectedUser(null);
                }}
            /> */}
        </div>
    );
};

export default SessionAttendanceView;
