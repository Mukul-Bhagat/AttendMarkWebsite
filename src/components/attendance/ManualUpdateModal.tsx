import React, { useState } from 'react';

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
}

interface ManualUpdateModalProps {
    isOpen: boolean;
    user: User | null;
    newStatus: 'PRESENT' | 'ABSENT';
    onConfirm: (reason?: string) => void;
    onCancel: () => void;
}

const ManualUpdateModal: React.FC<ManualUpdateModalProps> = ({
    isOpen,
    user,
    newStatus,
    onConfirm,
    onCancel
}) => {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !user) return null;

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(reason || undefined);
            setReason(''); // Reset reason
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setReason(''); // Reset reason
        onCancel();
    };

    // Determine action type
    const isMarkingAbsent = newStatus === 'ABSENT';
    const actionColor = isMarkingAbsent ? 'red' : 'green';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
                {/* Header */}
                <div className={`px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-${actionColor}-50 dark:bg-${actionColor}-900/20`}>
                    <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined text-3xl text-${actionColor}-600 dark:text-${actionColor}-400`}>
                            {isMarkingAbsent ? 'cancel' : 'check_circle'}
                        </span>
                        <h3 className={`text-xl font-bold text-${actionColor}-900 dark:text-${actionColor}-100`}>
                            Confirm Attendance Update
                        </h3>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                    <div className="mb-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            You are about to manually update attendance:
                        </p>

                        {/* User Info */}
                        <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-lg mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">User</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {user.name}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Email</span>
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {user.email}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Current Status</span>
                                <span className={`text-sm font-medium ${user.status === 'PRESENT' ? 'text-green-600' :
                                        user.status === 'LATE' ? 'text-yellow-600' :
                                            'text-red-600'
                                    }`}>
                                    {user.status}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 dark:text-gray-400">New Status</span>
                                <span className={`text-sm font-bold ${newStatus === 'PRESENT' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    {newStatus}
                                </span>
                            </div>
                        </div>

                        {/* Previous modification info */}
                        {user.isManuallyModified && user.updatedBy && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg mb-4">
                                <p className="text-xs text-blue-800 dark:text-blue-300 mb-1">
                                    <strong>Previously Modified</strong>
                                </p>
                                <p className="text-xs text-blue-700 dark:text-blue-400">
                                    By: {user.updatedBy.name} ({user.updatedBy.role})
                                </p>
                                {user.manualUpdatedAt && (
                                    <p className="text-xs text-blue-700 dark:text-blue-400">
                                        On: {new Date(user.manualUpdatedAt).toLocaleString('en-IN')}
                                    </p>
                                )}
                                {user.updateReason && (
                                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                        Reason: "{user.updateReason}"
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Warning for marking absent */}
                        {isMarkingAbsent && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg mb-4">
                                <div className="flex gap-2">
                                    <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400 text-lg">
                                        warning
                                    </span>
                                    <p className="text-xs text-yellow-800 dark:text-yellow-300">
                                        You are marking this user as <strong>ABSENT</strong>. This will override any existing attendance record.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Reason input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Reason for change (optional)
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g., Student forgot to scan QR code, Technical issue, etc."
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                This will be recorded in the audit log
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
                            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isSubmitting}
                            className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${isMarkingAbsent
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                                    </svg>
                                    Updating...
                                </span>
                            ) : (
                                `Confirm - Mark as ${newStatus}`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManualUpdateModal;
