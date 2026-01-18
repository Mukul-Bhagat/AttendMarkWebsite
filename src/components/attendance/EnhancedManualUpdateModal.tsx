import React, { useState, useEffect } from 'react';
import { canAdjustAttendance } from '../../utils/attendancePermissions';
import { useAuth } from '../../contexts/AuthContext'; // FIX: contexts (plural)
import toast from 'react-hot-toast';

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
    status: 'PRESENT' | 'ABSENT' | 'LATE';
    isManuallyModified: boolean;
    updatedBy: {
        name: string;
        role: string;
    } | null;
    manualUpdatedAt: string | null;
    updateReason: string | null;
    modificationHistory?: ModificationHistoryEntry[];
}

interface ManualUpdateModalProps {
    isOpen: boolean;
    user: User | null;
    newStatus: 'PRESENT' | 'ABSENT' | 'LATE';
    sessionName?: string;
    sessionDate?: string;
    onConfirm: (reason: string, lateMinutes?: number, status?: 'PRESENT' | 'ABSENT' | 'LATE') => Promise<void>;
    onCancel: () => void;
}

const EnhancedManualUpdateModal: React.FC<ManualUpdateModalProps> = ({
    isOpen,
    user,
    newStatus,
    sessionName,
    sessionDate,
    onConfirm,
    onCancel
}) => {
    const { user: currentUser } = useAuth();
    const [selectedStatus, setSelectedStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE'>(newStatus); // ✅ NEW: Editable status
    const [reason, setReason] = useState('');
    const [lateMinutes, setLateMinutes] = useState<number>(15);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Permission guard - should never open if user doesn't have permission
    const hasPermission = canAdjustAttendance(currentUser);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setSelectedStatus(newStatus); // Reset to initial status
            setReason('');
            setLateMinutes(15);
            setShowHistory(false);
        }
    }, [isOpen, newStatus]);

    if (!isOpen || !user) return null;

    // Security: Block if user doesn't have permission (double-check)
    if (!hasPermission) {
        toast.error('You do not have permission to adjust attendance');
        onCancel();
        return null;
    }

    // Validate reason length
    const isReasonValid = reason.trim().length >= 10 && reason.trim().length <= 500;
    const reasonError = reason.trim().length > 0 && !isReasonValid
        ? 'Reason must be between 10 and 500 characters'
        : '';

    // NO-OP detection (compare with selected status, not prop)
    const isNoOp = user.status === selectedStatus;

    // Validate form (using selectedStatus)
    // Validation Logic
    const isLateValid =
        selectedStatus !== 'LATE' ||
        (lateMinutes !== undefined && lateMinutes > 0);

    const canConfirm =
        reason.trim().length >= 10 &&
        isLateValid;

    const canSubmit = !isSubmitting && !isNoOp && canConfirm;

    const handleConfirm = async () => {
        // Final frontend validation
        if (!isReasonValid) {
            toast.error('Reason must be between 10 and 500 characters');
            return;
        }

        if (isNoOp) {
            toast.error('No status change detected');
            return;
        }

        if (selectedStatus === 'LATE' && (!lateMinutes || lateMinutes < 1)) {
            toast.error('Late minutes must be greater than 0');
            return;
        }

        setIsSubmitting(true);
        try {
            // Pass selectedStatus to parent (who then calls API with correct newStatus)
            // CRITICAL: Always pass lateMinutes (even if undefined) to preserve parameter order
            await onConfirm(
                reason.trim(),
                selectedStatus === 'LATE' ? lateMinutes : undefined,
                selectedStatus
            );
            setReason('');
            toast.success('Attendance adjusted successfully');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to adjust attendance');
            // Keep modal open on error
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setReason('');
        setLateMinutes(15);
        onCancel();
    };

    const confirmButtonClass =
        selectedStatus === 'LATE'
            ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
            : 'bg-green-600 hover:bg-green-700 text-white';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className={`px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-orange-50 dark:bg-orange-900/30`}>
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-3xl text-orange-600 dark:text-orange-400">
                            lock
                        </span>
                        <h3 className="text-xl font-bold text-orange-900 dark:text-orange-100">
                            🔐 Adjust Attendance (Admin Only)
                        </h3>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-4">
                    {/* Session Info */}
                    {(sessionName || sessionDate) && (
                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                            {sessionName && (
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    Session: {sessionName}
                                </p>
                            )}
                            {sessionDate && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    Date: {new Date(sessionDate).toLocaleDateString('en-IN')}
                                </p>
                            )}
                        </div>
                    )}

                    {/* User Info */}
                    <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Student</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {user.name}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Email</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {user.email}
                            </span>
                        </div>
                    </div>

                    {/* Status Change */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-blue-800 dark:text-blue-300 mb-1">Current Status</p>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${user.status === 'PRESENT' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                    user.status === 'LATE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    }`}>
                                    {user.status}
                                </span>
                            </div>
                            <span className="material-symbols-outlined text-2xl text-blue-600 dark:text-blue-400">
                                arrow_forward
                            </span>
                            <div>
                                <p className="text-xs text-blue-800 dark:text-blue-300 mb-1">New Status</p>
                                {/* ✅ NEW: Status Selector Dropdown */}
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value as 'PRESENT' | 'ABSENT' | 'LATE')}
                                    disabled={isSubmitting}
                                    className="px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-slate-700 border-2 border-blue-500 dark:border-blue-400 text-blue-900 dark:text-blue-100 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                                >
                                    <option value="PRESENT">PRESENT</option>
                                    <option value="ABSENT">ABSENT</option>
                                    <option value="LATE">LATE</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* NO-OP Warning */}
                    {isNoOp && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                            <div className="flex gap-2">
                                <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-lg">
                                    error
                                </span>
                                <p className="text-xs text-red-800 dark:text-red-300">
                                    <strong>No change detected!</strong> User is already {user.status}.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Late Minutes Input (only if marking LATE) - using selectedStatus */}
                    {selectedStatus === 'LATE' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Late Minutes <span className="text-red-600">*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="180"
                                value={lateMinutes}
                                onChange={(e) => setLateMinutes(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                disabled={isSubmitting}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                How many minutes late was the student?
                            </p>
                        </div>
                    )}

                    {/* Modification History (if exists) */}
                    {user.modificationHistory && user.modificationHistory.length > 0 && (
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowHistory(!showHistory)}
                                className="w-full flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                            >
                                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                    📋 Previous Modifications ({user.modificationHistory.length})
                                </span>
                                <span className={`material-symbols-outlined text-purple-600 dark:text-purple-400 transform transition-transform ${showHistory ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                            </button>

                            {showHistory && (
                                <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-2 max-h-48 overflow-y-auto">
                                    {user.modificationHistory.map((entry, index) => (
                                        <div key={index} className="text-xs text-purple-900 dark:text-purple-100 border-l-2 border-purple-400 pl-3 py-1">
                                            <p className="font-medium">
                                                {new Date(entry.modifiedAt).toLocaleString('en-IN')}
                                            </p>
                                            <p className="text-purple-700 dark:text-purple-300">
                                                {entry.modifiedBy.name} ({entry.modifiedBy.role})
                                            </p>
                                            <p className="mt-1">
                                                <strong>Action:</strong> {entry.action}
                                            </p>
                                            <p className="text-purple-700 dark:text-purple-300 italic">
                                                "{entry.reason}"
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reason Input (REQUIRED) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Reason for change <span className="text-red-600">*</span> (10-500 characters)
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g., Student was present but forgot to scan QR code due to network issue"
                            rows={3}
                            maxLength={500}
                            className={`w-full px-3 py-2 border ${reasonError ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
                                } rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500`}
                            disabled={isSubmitting}
                        />
                        <div className="flex items-center justify-between mt-1">
                            <p className={`text-xs ${reasonError ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                {reasonError || `${reason.length}/500 characters`}
                            </p>
                            {isReasonValid && (
                                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    Valid
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Permanent Audit Warning */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                        <div className="flex gap-2">
                            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-lg">
                                info
                            </span>
                            <p className="text-xs text-amber-900 dark:text-amber-100">
                                ⚠️ <strong>This action will be permanently logged</strong> in the audit trail with your name, timestamp, and reason.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={handleCancel}
                            disabled={isSubmitting}
                            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!canSubmit}
                            className={`
                                px-6 py-2 rounded-lg font-bold transition-all
                                ${canSubmit
                                    ? `${confirmButtonClass} shadow-lg hover:shadow-xl`
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }
                            `}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                                    </svg>
                                    Adjusting...
                                </span>
                            ) : (
                                `Confirm – Mark as ${selectedStatus}`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnhancedManualUpdateModal;
