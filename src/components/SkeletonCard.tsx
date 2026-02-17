import React from 'react';

interface SkeletonCardProps {
    variant?: 'card' | 'line' | 'avatar' | 'grid' | 'quota' | 'leave-card';
    count?: number;
    className?: string;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({
    variant = 'card',
    count = 1,
    className = ''
}) => {
    const renderSkeleton = () => {
        switch (variant) {
            case 'avatar':
                return (
                    <div className={`w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`} />
                );

            case 'line':
                return (
                    <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />
                );

            case 'quota':
                return (
                    <div className={`flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm ${className}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        </div>
                        <div className="h-8 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                );

            case 'leave-card':
                return (
                    <div style={{ flex: '0 0 320px' }} className={`rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark p-4 ${className}`}>
                        {/* User avatar and info */}
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                            </div>
                        </div>

                        {/* Date and status */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                        </div>

                        {/* Leave type and days */}
                        <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                );

            case 'grid':
                return (
                    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                </div>
                                <div className="h-8 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                );

            case 'card':
            default:
                return (
                    <div className={`rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark p-4 shadow-sm ${className}`}>
                        <div className="space-y-3 animate-pulse">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                        </div>
                    </div>
                );
        }
    };

    if (count === 1) {
        return renderSkeleton();
    }

    return (
        <>
            {Array.from({ length: count }).map((_, index) => (
                <React.Fragment key={index}>
                    {renderSkeleton()}
                </React.Fragment>
            ))}
        </>
    );
};

export default SkeletonCard;
