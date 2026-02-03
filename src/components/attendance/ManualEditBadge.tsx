/**
 * ============================================================================
 * MANUAL EDIT BADGE
 * ============================================================================
 * 
 * Visual indicator for manually edited attendance records
 * 
 * Purpose:
 * - Make manual edits immediately obvious in attendance tables
 * - Show tooltip with modifier's name
 * - Provide "View History" button if modification history exists
 * 
 * ============================================================================
 */

import React from 'react';

interface ManualEditBadgeProps {
    isModified: boolean;
    modifiedBy?: {
        name: string;
        role: string;
    };
    modifiedAt?: string;
    modificationCount?: number;
    onViewHistory?: () => void;
}

const ManualEditBadge: React.FC<ManualEditBadgeProps> = ({
    isModified,
    modifiedBy,
    modifiedAt,
    modificationCount,
    onViewHistory
}) => {
    if (!isModified) return null;

    const tooltipContent = modifiedBy
        ? `Modified by ${modifiedBy.name} (${modifiedBy.role})${modifiedAt ? `\n on ${new Date(modifiedAt).toLocaleString('en-IN')}` : ''}`
        : 'Manually adjusted';

    return (
        <div className="inline-flex items-center gap-2">
            {/* Badge */}
            <div
                className="group relative inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded text-xs font-medium text-orange-800 dark:text-orange-200"
                title={tooltipContent}
            >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>Edited</span>

                {/* Modification count */}
                {modificationCount && modificationCount > 1 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-orange-200 dark:bg-orange-800 rounded-full text-[10px] font-bold">
                        {modificationCount}×
                    </span>
                )}

                {/* Tooltip */}
                <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg whitespace-pre-line shadow-lg z-10 min-w-max max-w-xs">
                    {tooltipContent}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
                </div>
            </div>

            {/* View History Button */}
            {onViewHistory && (
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent row click
                        onViewHistory();
                    }}
                    className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:underline text-xs font-medium flex items-center gap-1"
                    title="View modification history"
                >
                    <span className="material-symbols-outlined text-sm">history</span>
                    View History
                </button>
            )}
        </div>
    );
};

export default ManualEditBadge;
