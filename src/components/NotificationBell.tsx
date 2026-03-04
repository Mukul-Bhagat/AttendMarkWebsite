import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { resolveNotificationRoute } from '../firebase/notificationDeepLink';
import { onMessageListener } from '../firebase/onMessageListener';
import { Role } from '../shared/roles';
import { appLogger } from '../shared/logger';

interface NotificationItem {
  _id: string;
  title: string;
  body?: string;
  message?: string;
  createdAt: string;
  isRead: boolean;
  readAt?: string | null;
  deepLink?: {
    web?: string;
    mobile?: string;
  };
  data?: Record<string, unknown>;
}

const getNotificationMessage = (notification: NotificationItem): string =>
  String(notification.body || notification.message || '').trim();

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPlatformOwner = user?.canonicalRole === Role.PLATFORM_OWNER;

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/api/notifications/unread-count');
      const nextCount = Number(response.data?.count || 0);

      setUnreadCount((prevCount) => {
        if (nextCount > prevCount && prevCount > 0) {
          setHasNewNotification(true);
          setTimeout(() => setHasNewNotification(false), 1000);
        }
        return nextCount;
      });
    } catch (error) {
      appLogger.error('Failed to fetch unread count:', error);
      setUnreadCount(0);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/notifications?limit=20');
      const data = response.data?.data;

      if (Array.isArray(data)) {
        setNotifications(data);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      appLogger.error('Failed to fetch notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.post(`/api/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((item) => (item._id === notificationId ? { ...item, isRead: true } : item)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      appLogger.error('Failed to mark notification as read:', error);
    }
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }

    const route = resolveNotificationRoute(notification);
    if (route) {
      navigate(route);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    onMessageListener((payload: any) => {
      const title = String(payload?.notification?.title || 'New notification');
      const body = String(payload?.notification?.body || payload?.data?.body || '');
      const notificationId = String(payload?.data?.notificationId || `fcm-${Date.now()}`);

      setHasNewNotification(true);
      setTimeout(() => setHasNewNotification(false), 1000);
      setUnreadCount((prev) => prev + 1);

      setNotifications((prev) => {
        const nextItem: NotificationItem = {
          _id: notificationId,
          title,
          body,
          message: body,
          createdAt: new Date().toISOString(),
          isRead: false,
          deepLink: {
            web: typeof payload?.data?.deepLinkWeb === 'string' ? payload.data.deepLinkWeb : undefined,
          },
          data: payload?.data,
        };

        const deduped = prev.filter((item) => item._id !== nextItem._id);
        return [nextItem, ...deduped].slice(0, 20);
      });

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/assets/favicon.png',
        });
      }
    })
      .then((cleanup) => {
        unsubscribe = cleanup;
      })
      .catch((error) => {
        appLogger.warn('Foreground listener initialization failed', error);
      });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleBellClick = () => {
    if (isPlatformOwner) {
      navigate('/admin/notifications');
      return;
    }

    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (isPlatformOwner) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

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
      <button
        onClick={handleBellClick}
        className={`relative p-2 text-gray-600 hover:text-orange-600 dark:text-gray-300 dark:hover:text-orange-400 transition-all rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 ${hasNewNotification ? 'animate-bell-shake' : ''}`}
        aria-label="Notifications"
        title={isPlatformOwner ? 'Manage Notifications' : 'View Notifications'}
      >
        <span className="material-symbols-outlined text-2xl">notifications</span>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-gradient-to-r from-red-600 to-orange-600 rounded-full min-w-[18px] animate-badge-pop shadow-lg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {!isPlatformOwner && isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 max-h-[calc(100vh-100px)] flex flex-col animate-dropdown-slide origin-top-right">
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

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-3">
                  notifications_off
                </span>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No notifications yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 cursor-pointer transition-all hover:shadow-inner ${notification.isRead
                      ? 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-750'
                      : 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 hover:from-orange-100 hover:to-red-100 dark:hover:from-orange-900/30 dark:hover:to-red-900/30 border-l-4 border-orange-500'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${notification.isRead
                        ? 'bg-gray-100 dark:bg-slate-700'
                        : 'bg-gradient-to-br from-orange-500 to-red-600'}`}>
                        <span className={`material-symbols-outlined text-xl ${notification.isRead ? 'text-gray-600 dark:text-gray-400' : 'text-white'}`}>
                          notifications
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold mb-1 ${notification.isRead
                          ? 'text-gray-900 dark:text-white'
                          : 'text-orange-900 dark:text-orange-100'}`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-1">
                          {getNotificationMessage(notification)}
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

          {notifications.length > 0 && (
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
