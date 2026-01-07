import React from 'react';

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
}

interface AttendanceCheckboxProps {
    user: User;
    canEdit: boolean;
    onChange: (user: User, checked: boolean) => void;
}

const AttendanceCheckbox: React.FC<AttendanceCheckboxProps> = ({ user, canEdit, onChange }) => {
    const isChecked = user.status === 'PRESENT' || user.status === 'LATE';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (canEdit) {
            onChange(user, e.target.checked);
        }
    };

    // Status color
    const getStatusColor = () => {
        switch (user.status) {
            case 'PRESENT':
                return 'text-green-600 dark:text-green-400';
            case 'LATE':
                return 'text-yellow-600 dark:text-yellow-400';
            case 'ABSENT':
                return 'text-red-600 dark:text-red-400';
            default:
                return 'text-gray-600 dark:text-gray-400';
        }
    };

    // Tooltip text
    const getTooltipText = () => {
        if (!canEdit) {
            return 'You do not have permission to edit attendance';
        }

        if (user.isManuallyModified && user.updatedBy) {
            return `Last modified by ${user.updatedBy.name} on ${new Date(user.manualUpdatedAt!).toLocaleString()}`;
        }

        if (isChecked) {
            return 'Click to mark as Absent';
        } else {
            return 'Click to mark as Present';
        }
    };

    return (
        <div className="flex items-center gap-3" title={getTooltipText()}>
            {/* Checkbox */}
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={handleChange}
                    disabled={!canEdit}
                    className={`
            w-6 h-6 rounded border-2 
            ${isChecked ? 'bg-green-500 border-green-500' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600'}
            ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
            focus:outline-none focus:ring-2 focus:ring-[#f04129] focus:ring-offset-2
            transition-all duration-200
          `}
                />
                {isChecked && (
                    <span className="material-symbols-outlined absolute left-0 top-0 w-6 h-6 text-white pointer-events-none text-lg">
                        check
                    </span>
                )}
            </label>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
                <span className={`font-medium text-sm ${getStatusColor()}`}>
                    {user.status}
                </span>

                {/* Manual modification indicator */}
                {user.isManuallyModified && (
                    <span
                        className="material-symbols-outlined text-blue-500 dark:text-blue-400 text-sm"
                        title={`Manually modified by ${user.updatedBy?.name || 'Admin'}`}
                    >
                        edit_note
                    </span>
                )}
            </div>
        </div>
    );
};

export default AttendanceCheckbox;
