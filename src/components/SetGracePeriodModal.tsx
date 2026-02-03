import React, { useState, useEffect } from 'react';
import api from '../api';

interface IUser {
    _id?: string;
    id?: string;
    email: string;
    profile: {
        firstName: string;
        lastName: string;
    };
}

interface SetGracePeriodModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: IUser | null;
}

interface UserClass {
    _id: string;
    classBatchId: {
        _id: string;
        name: string;
    };
    individualGracePeriod?: number;
}

interface GracePeriodInfo {
    classId: string;
    className: string;
    effectiveGracePeriod: number;
    individualOverride?: number;
    classGracePeriod?: number;
    organizationGracePeriod: number;
    source: 'USER' | 'CLASS' | 'ORGANIZATION';
}

const SetGracePeriodModal: React.FC<SetGracePeriodModalProps> = ({ isOpen, onClose, user }) => {
    const [userClasses, setUserClasses] = useState<UserClass[]>([]);
    const [gracePeriods, setGracePeriods] = useState<Record<string, number>>({});
    const [hasOverride, setHasOverride] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [gracePeriodInfo, setGracePeriodInfo] = useState<GracePeriodInfo[]>([]);

    useEffect(() => {
        if (isOpen && user) {
            fetchUserClasses();
        }
    }, [isOpen, user]);

    const fetchUserClasses = async () => {
        if (!user) return;
        const userId = user._id || user.id;
        if (!userId) return;

        setLoading(true);
        try {
            // Get user's class memberships
            const membershipRes = await api.get(`/api/membership/${userId}/memberships`);
            const memberships = membershipRes.data.memberships || [];
            setUserClasses(memberships);

            // Get current grace periods for all classes
            const gpRes = await api.get(`/api/grace-period/${userId}/grace-periods`);
            const gpData = gpRes.data.gracePeriods || [];

            setGracePeriodInfo(gpData);

            // Build grace period map and override status
            const gpMap: Record<string, number> = {};
            const overrideMap: Record<string, boolean> = {};

            gpData.forEach((gp: GracePeriodInfo) => {
                gpMap[gp.classId] = gp.individualOverride || gp.effectiveGracePeriod;
                overrideMap[gp.classId] = !!gp.individualOverride;
            });

            setGracePeriods(gpMap);
            setHasOverride(overrideMap);
        } catch (err: any) {
            console.error('Error fetching grace periods:', err);
            alert(err.response?.data?.msg || 'Failed to load grace period data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGracePeriod = async (classBatchId: string) => {
        if (!user) return;
        const userId = user._id || user.id;
        if (!userId) return;

        setSaving(classBatchId);
        try {
            await api.post(`/api/grace-period/${userId}/set-grace-period`, {
                classBatchId,
                gracePeriodMinutes: gracePeriods[classBatchId] || 0,
            });

            // Show success message
            const successDiv = document.createElement('div');
            successDiv.className = 'fixed top-4 right-4 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-6 py-3 rounded-lg shadow-lg z-50';
            successDiv.textContent = 'Grace period updated successfully';
            document.body.appendChild(successDiv);
            setTimeout(() => successDiv.remove(), 3000);

            // Refresh data
            await fetchUserClasses();
        } catch (err: any) {
            console.error('Error saving grace period:', err);
            alert(err.response?.data?.msg || 'Failed to update grace period');
        } finally {
            setSaving(null);
        }
    };

    const handleRemoveOverride = async (classBatchId: string) => {
        if (!user) return;
        const userId = user._id || user.id;
        if (!userId) return;

        if (!window.confirm('Are you sure you want to remove this individual override? The user will inherit the class or organization default.')) {
            return;
        }

        setSaving(classBatchId);
        try {
            await api.delete(`/api/grace-period/${userId}/grace-period/${classBatchId}`);

            // Show success message
            const successDiv = document.createElement('div');
            successDiv.className = 'fixed top-4 right-4 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 px-6 py-3 rounded-lg shadow-lg z-50';
            successDiv.textContent = 'Override removed successfully';
            document.body.appendChild(successDiv);
            setTimeout(() => successDiv.remove(), 3000);

            // Refresh data
            await fetchUserClasses();
        } catch (err: any) {
            console.error('Error removing override:', err);
            alert(err.response?.data?.msg || 'Failed to remove override');
        } finally {
            setSaving(null);
        }
    };

    const getGracePeriodSource = (classId: string) => {
        const info = gracePeriodInfo.find((gp) => gp.classId === classId);
        if (!info) return 'Unknown';

        if (info.source === 'USER') return 'Individual Override';
        if (info.source === 'CLASS') return 'Class Default';
        return 'Organization Default';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Set Grace Period
                        </h2>
                        {user && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {user.profile.firstName} {user.profile.lastName} ({user.email})
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined text-gray-600 dark:text-gray-400">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <svg className="animate-spin h-8 w-8 text-[#f04129]" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                            </svg>
                        </div>
                    ) : userClasses.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">school</span>
                            <p className="text-gray-500 dark:text-gray-400">This user is not enrolled in any classes.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {userClasses.map((membership) => {
                                const classId = membership.classBatchId?._id;
                                const className = membership.classBatchId?.name || 'Unknown Class';
                                const currentValue = gracePeriods[classId] || 0;
                                const isOverride = hasOverride[classId];
                                const source = getGracePeriodSource(classId);

                                return (
                                    <div key={membership._id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-5 bg-gray-50 dark:bg-slate-900/50">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">
                                                    {className}
                                                </h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    Current effective: <span className="font-semibold">{currentValue} minutes</span>
                                                    {' '}({source})
                                                </p>
                                            </div>
                                            {isOverride && (
                                                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-medium rounded">
                                                    Overridden
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-end gap-3">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Individual Grace Period (Minutes)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="180"
                                                    value={gracePeriods[classId] || 0}
                                                    onChange={(e) => setGracePeriods(prev => ({
                                                        ...prev,
                                                        [classId]: Math.min(180, Math.max(0, parseInt(e.target.value) || 0))
                                                    }))}
                                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                                                    placeholder="0-180"
                                                    disabled={saving === classId}
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleSaveGracePeriod(classId)}
                                                disabled={saving === classId}
                                                className="px-5 py-2 bg-[#f04129] text-white rounded-lg font-medium hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {saving === classId ? (
                                                    <>
                                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                                                        </svg>
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined text-lg">save</span>
                                                        Save
                                                    </>
                                                )}
                                            </button>
                                            {isOverride && (
                                                <button
                                                    onClick={() => handleRemoveOverride(classId)}
                                                    disabled={saving === classId}
                                                    className="px-5 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SetGracePeriodModal;
