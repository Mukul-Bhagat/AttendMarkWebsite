import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { getReportShareRequests } from '../../../api/reportingApi';
import { useAuth } from '../../../contexts/AuthContext';

const RequestQueueNotification: React.FC = () => {
    const { isSuperAdmin, isCompanyAdmin, isManager, isSessionAdmin, isPlatformOwner } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    // Check for pending requests if user is an admin
    const checkRequests = async () => {
        if (!(isSuperAdmin || isCompanyAdmin || isManager || isSessionAdmin || isPlatformOwner)) {
            return;
        }

        try {
            const response = await getReportShareRequests('PENDING');
            const requests = response.data?.data || [];
            setPendingCount(requests.length);

            // Show notification if there are pending requests
            if (requests.length > 0) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        } catch (err) {
            console.error('[RequestQueueNotification] Failed to fetch count:', err);
        }
    };

    useEffect(() => {
        checkRequests();

        // Polling every 5 minutes to keep it updated without being too heavy
        const interval = setInterval(checkRequests, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [isSuperAdmin, isCompanyAdmin, isManager, isSessionAdmin, isPlatformOwner]);

    if (!isVisible || pendingCount === 0) return null;

    return (
        <div
            className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
                }`}
        >
            <div className="bg-white dark:bg-surface-dark rounded-3xl shadow-2xl border-2 border-primary/20 p-5 pr-12 relative min-w-[300px] max-w-[400px]">
                {/* Icon Section */}
                <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-2xl flex items-center justify-center text-primary relative flex-shrink-0">
                        <Bell size={24} className={pendingCount > 0 ? 'animate-bounce' : ''} />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-surface-dark" />
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 pt-1">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Approval Required</p>
                        <h4 className="text-base font-black text-text-primary-light dark:text-text-primary-dark mb-0.5">
                            {pendingCount} Report {pendingCount === 1 ? 'Request' : 'Requests'}
                        </h4>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-medium">
                            Waiting in your approval queue
                        </p>
                    </div>
                </div>

                {/* Close Button */}
                <button
                    onClick={() => setIsVisible(false)}
                    className="absolute top-3 right-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 p-1.5 rounded-full transition-all hover:scale-110"
                    aria-label="Close notification"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Pulsing Aura */}
            <div className="absolute -inset-1 bg-primary/5 rounded-[40px] animate-pulse -z-10" />
        </div>
    );
};

export default RequestQueueNotification;
