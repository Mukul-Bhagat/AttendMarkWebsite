import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { Role } from '../shared/roles';

interface Organization {
    _id: string; // Used in component
    id?: string;
    name: string;
    organizationPrefix?: string; // Used in component
    collectionPrefix?: string;
}

interface SentNotification {
    _id: string;
    title: string;
    message: string;
    targetType: 'ALL' | 'ORGANIZATION';
    targetOrgIds: any[];
    createdAt: string;
    deliveredCount: number;
    failedCount: number;
}

const AdminNotifications: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Form state
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [targetType, setTargetType] = useState<'ALL' | 'ORGANIZATION'>('ALL');
    const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);

    // Data
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [history, setHistory] = useState<SentNotification[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Redirect if not platform owner (route protection should handle this, but extra safety)
    useEffect(() => {
        if (user && user.canonicalRole !== Role.PLATFORM_OWNER) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    // Fetch organizations
    useEffect(() => {
        const fetchOrganizations = async () => {
            try {
                const response = await api.get('/platform/organizations');
                const data = response.data?.organizations || response.data;
                // CRASH PREVENTION: Ensure we always have an array
                if (Array.isArray(data)) {
                    setOrganizations(data);
                } else {
                    console.warn('Organizations API returned non-array:', data);
                    setOrganizations([]);
                }
            } catch (error) {
                console.error('Failed to fetch organizations:', error);
                setOrganizations([]); // Safe fallback
            }
        };

        fetchOrganizations();
    }, []);

    // Fetch notification history
    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const response = await api.get('/admin/notifications?limit=10');
            const data = response.data;
            // CRASH PREVENTION: Ensure we always have an array
            if (Array.isArray(data)) {
                setHistory(data);
            } else {
                console.warn('Notification history API returned non-array:', data);
                setHistory([]);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
            setHistory([]); // Safe fallback
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    // Validation
    const isValid = () => {
        if (!title.trim() || !message.trim()) return false;
        if (targetType === 'ORGANIZATION' && selectedOrgs.length === 0) return false;
        return true;
    };

    // Handle send
    const handleSend = async () => {
        if (!isValid()) {
            setError('Please fill all required fields');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            await api.post('/admin/notifications/send', {
                title,
                message,
                targetType,
                organizationIds: targetType === 'ORGANIZATION' ? selectedOrgs : undefined
            });

            setSuccess('✅ Notification sent successfully!');

            // Reset form
            setTitle('');
            setMessage('');
            setTargetType('ALL');
            setSelectedOrgs([]);

            // Refresh history
            fetchHistory();

            // Clear success message after 3s
            setTimeout(() => setSuccess(''), 3000);

        } catch (error: any) {
            setError(error.response?.data?.message || 'Failed to send notification');
        } finally {
            setLoading(false);
        }
    };

    // Toggle org selection
    const toggleOrg = (orgId: string) => {
        setSelectedOrgs(prev =>
            prev.includes(orgId)
                ? prev.filter(id => id !== orgId)
                : [...prev, orgId]
        );
    };

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                        📢 Notifications (Admin)
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Send platform-wide or organization-specific notifications
                    </p>
                </div>

                {/* Alert Messages */}
                {success && (
                    <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg flex items-center gap-2">
                        <span className="material-symbols-outlined">check_circle</span>
                        {success}
                    </div>
                )}

                {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
                        <span className="material-symbols-outlined">error</span>
                        {error}
                    </div>
                )}

                {/* Notification Form */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-orange-600">edit_notifications</span>
                        Create Notification
                    </h2>

                    <div className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Title *
                                <span className="ml-2 text-xs text-gray-500">
                                    {title.length} / 100
                                </span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                                placeholder="e.g., System Maintenance Notice"
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-900 dark:text-white"
                                maxLength={100}
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Message *
                                <span className="ml-2 text-xs text-gray-500">
                                    {message.length} / 500
                                </span>
                                {message.length > 400 && (
                                    <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                                        Keep it concise!
                                    </span>
                                )}
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                                placeholder="Write a clear message for organizations..."
                                rows={4}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-slate-900 dark:text-white resize-none"
                                maxLength={500}
                            />
                        </div>

                        {/* Target Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Target Audience *
                            </label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                                    <input
                                        type="radio"
                                        name="targetType"
                                        value="ALL"
                                        checked={targetType === 'ALL'}
                                        onChange={() => {
                                            setTargetType('ALL');
                                            setSelectedOrgs([]);
                                        }}
                                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 dark:text-white">All Organizations</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Send to everyone on the platform</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                                    <input
                                        type="radio"
                                        name="targetType"
                                        value="ORGANIZATION"
                                        checked={targetType === 'ORGANIZATION'}
                                        onChange={() => setTargetType('ORGANIZATION')}
                                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 dark:text-white">Selected Organizations</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Choose specific organizations</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Organization Selector */}
                        {targetType === 'ORGANIZATION' && (
                            <div className="animate-fadeIn">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    Select Organizations *
                                    {selectedOrgs.length > 0 && (
                                        <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">
                                            {selectedOrgs.length} selected
                                        </span>
                                    )}
                                </label>
                                <div className="border border-gray-300 dark:border-slate-600 rounded-lg max-h-64 overflow-y-auto">
                                    {!Array.isArray(organizations) || organizations.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                            <span className="material-symbols-outlined text-4xl mb-2">info</span>
                                            <p className="text-sm">No organizations available</p>
                                        </div>
                                    ) : (
                                        organizations.map((org) => (
                                            <label
                                                key={org._id}
                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer border-b border-gray-100 dark:border-slate-700 last:border-0"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOrgs.includes(org._id)}
                                                    onChange={() => toggleOrg(org._id)}
                                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900 dark:text-white">{org.name}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">@{org.organizationPrefix}</div>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Preview */}
                        {(title || message) && (
                            <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    📱 Preview
                                </label>
                                <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white text-xl">notifications</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                                                {title || 'Notification Title'}
                                            </p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                                                {message || 'Notification message preview...'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Just now</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Send Button */}
                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => {
                                    setTitle('');
                                    setMessage('');
                                    setTargetType('ALL');
                                    setSelectedOrgs([]);
                                }}
                                className="px-6 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={!isValid() || loading}
                                className={`px-6 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 ${isValid() && !loading
                                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 shadow-lg hover:shadow-xl'
                                    : 'bg-gray-300 dark:bg-slate-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                                        </svg>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">send</span>
                                        Send Notification
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notification History */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">history</span>
                        Sent Notifications
                    </h2>

                    {loadingHistory ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                        </div>
                    ) : !Array.isArray(history) || history.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-3">inbox</span>
                            <p className="text-gray-500 dark:text-gray-400">No notifications sent yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((notif) => (
                                <div
                                    key={notif._id}
                                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                                                {notif.title}
                                            </h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                                                {notif.message}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">schedule</span>
                                                    {formatDate(notif.createdAt)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">
                                                        {notif.targetType === 'ALL' ? 'public' : 'groups'}
                                                    </span>
                                                    {notif.targetType === 'ALL'
                                                        ? 'All Organizations'
                                                        : `${Array.isArray(notif.targetOrgIds) ? notif.targetOrgIds.length : 0} Organization${(Array.isArray(notif.targetOrgIds) && notif.targetOrgIds.length > 1) ? 's' : ''}`
                                                    }
                                                </span>
                                                {notif.deliveredCount !== undefined && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
                                                        {notif.deliveredCount} delivered
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
            </div>

            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default AdminNotifications;
