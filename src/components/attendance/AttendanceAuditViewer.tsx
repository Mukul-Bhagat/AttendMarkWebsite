/**
 * ============================================================================
 * ATTENDANCE AUDIT VIEWER
 * ============================================================================
 * 
 * Full transparency component for viewing attendance modification history
 * 
 * Access Control:
 * - CompanyAdmin/SuperAdmin: Full access to own org
 * - PLATFORM_OWNER: Full access to all orgs
 * - Manager/SessionAdmin/EndUser: NO ACCESS
 * 
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { canViewAuditTrail } from '../../utils/attendancePermissions';
import { useAuth } from '../../contexts/AuthContext'; // FIX: contexts (plural)
import { getSessionAuditTrail, exportAuditTrailCSV, type AttendanceAuditEntry } from '../../api/attendanceAdjustment';
import toast from 'react-hot-toast';

import { appLogger } from '../../shared/logger';
interface AttendanceAuditViewerProps {
    sessionId: string;
    sessionName: string;
    sessionDate?: string;
    isOpen: boolean;
    onClose: () => void;
}

const AttendanceAuditViewer: React.FC<AttendanceAuditViewerProps> = ({
    sessionId,
    sessionName,
    sessionDate,
    isOpen,
    onClose
}) => {
    const { user: currentUser } = useAuth();
    const [auditLog, setAuditLog] = useState<AttendanceAuditEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'manual' | 'recent'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Permission check
    const hasPermission = canViewAuditTrail(currentUser);

    // Load audit trail when modal opens
    useEffect(() => {
        if (isOpen && hasPermission) {
            loadAuditTrail();
        }
    }, [isOpen, sessionId]);

    const loadAuditTrail = async () => {
        setLoading(true);
        try {
            const data = await getSessionAuditTrail(sessionId, sessionDate);
            setAuditLog(data);
        } catch (error: any) {
            toast.error('Failed to load audit trail');
            appLogger.error('Audit trail error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            await exportAuditTrailCSV(sessionId, sessionName);
            toast.success('Audit trail exported successfully');
        } catch (error: any) {
            toast.error('Failed to export audit trail');
        }
    };

    if (!isOpen) return null;

    if (!hasPermission) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 max-w-md">
                    <h3 className="text-xl font-bold text-red-600 mb-4">Access Denied</h3>
                    <p className="text-gray-700 dark:text-gray-300">
                        Audit trails are restricted to Company Admins and Platform Owners.
                    </p>
                    <button
                        onClick={onClose}
                        className="mt-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // Filter audit log
    const filteredLog = auditLog.filter(entry => {
        // Filter by type
        if (filter === 'manual' && !entry.action.includes('MANUAL')) return false;
        if (filter === 'recent') {
            const entryDate = new Date(entry.timestamp);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            if (entryDate < weekAgo) return false;
        }

        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (
                entry.userName.toLowerCase().includes(search) ||
                entry.reason.toLowerCase().includes(search) ||
                entry.modifiedBy.name.toLowerCase().includes(search)
            );
        }

        return true;
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-3xl text-purple-600 dark:text-purple-400">
                                history
                            </span>
                            <div>
                                <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">
                                    📋 Attendance Modification History
                                </h3>
                                <p className="text-sm text-purple-700 dark:text-purple-300">
                                    {sessionName}
                                    {sessionDate && ` - ${new Date(sessionDate).toLocaleDateString('en-IN')}`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <span className="material-symbols-outlined text-2xl">close</span>
                        </button>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Filter Tabs */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${filter === 'all'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                                    }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('manual')}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${filter === 'manual'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                                    }`}
                            >
                                Manual Only
                            </button>
                            <button
                                onClick={() => setFilter('recent')}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${filter === 'recent'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                                    }`}
                            >
                                Last 7 Days
                            </button>
                        </div>

                        {/* Search */}
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by student, reason, or admin..."
                            className="flex-1 min-w-[200px] px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />

                        {/* Export Button */}
                        <button
                            onClick={handleExportCSV}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-lg">download</span>
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Audit Log List */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
                        </div>
                    ) : filteredLog.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="material-symbols-outlined text-6xl text-gray-400 dark:text-gray-600 mb-4">
                                history_toggle_off
                            </span>
                            <p className="text-gray-600 dark:text-gray-400">
                                {searchTerm || filter !== 'all'
                                    ? 'No matching modification records found'
                                    : 'No attendance modifications yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredLog.map((entry, index) => (
                                <div
                                    key={index}
                                    className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-600 rounded-lg p-4 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">
                                                    person
                                                </span>
                                                <span className="font-medium text-gray-900 dark:text-white">
                                                    {entry.userName}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${entry.changeType === 'ABSENT_TO_PRESENT'
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    : entry.changeType === 'PRESENT_TO_ABSENT'
                                                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                    }`}>
                                                    {entry.changeType.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 italic mb-2">
                                                "{entry.reason}"
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">person</span>
                                                    {entry.modifiedBy.name} ({entry.modifiedBy.role})
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">schedule</span>
                                                    {new Date(entry.timestamp).toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {filteredLog.length} {filteredLog.length === 1 ? 'modification' : 'modifications'}
                            {filter !== 'all' || searchTerm ? ' (filtered)' : ''}
                        </p>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceAuditViewer;
