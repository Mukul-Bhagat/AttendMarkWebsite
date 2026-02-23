import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { onMessageListener } from '../firebase/onMessageListener';
import { Role } from '../shared/roles';

import { appLogger } from '../shared/logger';
interface Notification {
    _id: string;
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
    createdBy?: {
        name: string;
        email: string;
    };
}

const NotificationBell: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasNewNotification, setHasNewNotification] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Check if user is Platform Owner
    const isPlatformOwner = user?.canonicalRole === Role.PLATFORM_OWNER;

    // Fetch unread count on mount and periodically
    const fetchUnreadCount = async () => {
        try {
            const response = await api.get('/api/notifications/unread-count');
            const newCount = response.data?.count || 0;

            // Trigger bell shake if count increased
            if (newCount > unreadCount && unreadCount > 0) {
                setHasNewNotification(true);
                setTimeout(() => setHasNewNotification(false), 1000);
            }

            setUnreadCount(newCount);
        } catch (error) {
            appLogger.error('Failed to fetch unread count:', error);
            setUnreadCount(0); // Safe fallback
        }
    };

    // Fetch notifications when dropdown opens
    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/notifications?limit=20');
            const data = response.data?.data;

            // CRASH PREVENTION: Ensure we always have an array
            if (Array.isArray(data)) {
                setNotifications(data);
            } else {
                appLogger.warn('Notifications API returned non-array:', data);
                setNotifications([]);
            }
        } catch (error) {
            appLogger.error('Failed to fetch notifications:', error);
            setNotifications([]); // Safe fallback
        } finally {
            setLoading(false);
        }
    };

    // Mark notification as read
    const markAsRead = async (notificationId: string) => {
        try {
            await api.post(`/api/notifications/${notificationId}/read`);

            // Update local state
            setNotifications(prev =>
                Array.isArray(prev) ? prev.map(n =>
                    n._id === notificationId ? { ...n, isRead: true } : n
                ) : []
            );

            // Decrease unread count
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            appLogger.error('Failed to mark notification as read:', error);
        }
    };

    // Listen for foreground FCM messages
    useEffect(() => {
        fetchUnreadCount();

        // Real-time updates from FCM
        onMessageListener().then((payload: any) => {
            appLogger.info('[Foreground] Notification received:', payload);

            // Increment unread count and trigger animation
            setUnreadCount(prev => prev + 1);
            setHasNewNotification(true);
            setTimeout(() => setHasNewNotification(false), 1000);

            // Optionally show browser notification if not already shown
            if (payload.notification && Notification.permission === 'granted') {
                new Notification(payload.notification.title, {
                    body: payload.notification.body,
                    icon: '/logo192.png'
                });
            }
        }).catch(err => appLogger.error('Error in foreground listener:', err));

        // Refresh unread count every 60 seconds
        const interval = setInterval(fetchUnreadCount, 60000);

        return () => clearInterval(interval);
    }, [unreadCount]);

    // Handle bell icon click
    const handleBellClick = () => {
        // Platform Owner: Redirect to admin notification page
        if (isPlatformOwner) {
            navigate('/admin/notifications');
            return;
        }

        // Regular users: Toggle dropdown
        if (!isOpen) {
            fetchNotifications();
        }
        setIsOpen(!isOpen);
    };

    // Close dropdown when clicking outside (only for non-platform owners)
    useEffect(() => {
        if (isPlatformOwner) return; // Platform Owner doesn't use dropdown

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        // Close on ESC key
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, isPlatformOwner]);

    // Format relative time
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon Button with Shake Animation */}
            <button
                onClick={handleBellClick}
                className={`relative p-2 text-gray-600 hover:text-orange-600 dark:text-gray-300 dark:hover:text-orange-400 transition-all rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 ${hasNewNotification ? 'animate-bell-shake' : ''
                    }`}
                aria-label="Notifications"
                title={isPlatformOwner ? "Manage Notifications" : "View Notifications"}
            >
                <span className="material-symbols-outlined text-2xl">
                    notifications
                </span>

                {/* Unread Badge with Pop Animation */}
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-gradient-to-r from-red-600 to-orange-600 rounded-full min-w-[18px] animate-badge-pop shadow-lg">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel - ONLY for non-Platform Owners */}
            {!isPlatformOwner && isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 max-h-[calc(100vh-100px)] flex flex-col animate-dropdown-slide origin-top-right">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-t-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-orange-600">notifications_active</span>
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="overflow-y-auto flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                            </div>
                        ) : !Array.isArray(notifications) || notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-3">
                                    notifications_off
                                </span>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">
                                    No notifications yet
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    You're all caught up!
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification._id}
                                        onClick={() => !notification.isRead && markAsRead(notification._id)}
                                        className={`px-4 py-3 cursor-pointer transition-all hover:shadow-inner ${notification.isRead
                                            ? 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-750'
                                            : 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 hover:from-orange-100 hover:to-red-100 dark:hover:from-orange-900/30 dark:hover:to-red-900/30 border-l-4 border-orange-500'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${notification.isRead
                                                ? 'bg-gray-100 dark:bg-slate-700'
                                                : 'bg-gradient-to-br from-orange-500 to-red-600'
                                                }`}>
                                                <span className={`material-symbols-outlined text-xl ${notification.isRead ? 'text-gray-600 dark:text-gray-400' : 'text-white'
                                                    }`}>
                                                    notifications
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold mb-1 ${notification.isRead
                                                    ? 'text-gray-900 dark:text-white'
                                                    : 'text-orange-900 dark:text-orange-100'
                                                    }`}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-1">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {formatTime(notification.createdAt)}
                                                    </p>
                                                    {!notification.isRead && (
                                                        <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                                                            NEW
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {Array.isArray(notifications) && notifications.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 rounded-b-xl">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium w-full text-center py-1"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Animations */}
            <style>{`
                @keyframes bellShake {
                    0%, 100% { transform: rotate(0deg); }
                    10% { transform: rotate(-15deg); }
                    20% { transform: rotate(15deg); }
                    30% { transform: rotate(-15deg); }
                    40% { transform: rotate(15deg); }
                    50% { transform: rotate(-10deg); }
                    60% { transform: rotate(10deg); }
                    70% { transform: rotate(-5deg); }
                    80% { transform: rotate(5deg); }
                    90% { transform: rotate(0deg); }
                }

                .animate-bell-shake {
                    animation: bellShake 0.6s ease-in-out;
                }

                @keyframes badgePop {
                    0% {
                        transform: scale(0);
                        opacity: 0;
                    }
                    50% {
                        transform: scale(1.2);
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                .animate-badge-pop {
                    animation: badgePop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                }

                @keyframes dropdownSlide {
                    0% {
                        opacity: 0;
                        transform: translateY(-10px) scale(0.95);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                .animate-dropdown-slide {
                    animation: dropdownSlide 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default NotificationBell;
