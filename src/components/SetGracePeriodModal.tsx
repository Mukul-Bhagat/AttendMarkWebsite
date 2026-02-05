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

    const [globalGracePeriod, setGlobalGracePeriod] = useState<number | null>(null);
    const [hasGlobalOverride, setHasGlobalOverride] = useState(false);

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
            // Get user's classes
            const membershipRes = await api.get(`/api/grace-period/${userId}/user-classes`);
            const memberships = membershipRes.data.memberships || [];
            setUserClasses(memberships);

            // Get grace periods
            const gpRes = await api.get(`/api/grace-period/${userId}/grace-periods`);
            const gpData = gpRes.data.gracePeriods || [];
            const globalOverride = gpRes.data.globalOverride;

            setGracePeriodInfo(gpData);
            setGlobalGracePeriod(globalOverride !== undefined && globalOverride !== null ? globalOverride : null);
            setHasGlobalOverride(globalOverride !== undefined && globalOverride !== null);

            // Build map
            const gpMap: Record<string, number> = {};
            const overrideMap: Record<string, boolean> = {};

            gpData.forEach((gp: GracePeriodInfo) => {
                gpMap[gp.classId] = gp.individualOverride !== undefined ? gp.individualOverride : gp.effectiveGracePeriod;
                overrideMap[gp.classId] = gp.individualOverride !== undefined;
            });

            setGracePeriods(gpMap);
            setHasOverride(overrideMap);

        } catch (err: any) {
            console.error('[SetGracePeriodModal] Error fetching data:', err);
            const errorMsg = err.response?.data?.msg || err.message || 'Failed to load grace period data';
            // alert(`Error loading data: ${errorMsg}`); // Suppress alert to avoid UI clutter
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

        setSaving(classBatchId);
        try {
            await api.delete(`/api/grace-period/${userId}/grace-period/${classBatchId}`);
            await fetchUserClasses();
        } catch (err: any) {
            console.error('Error removing override:', err);
            alert(err.response?.data?.msg || 'Failed to remove override');
        } finally {
            setSaving(null);
        }
    };

    const handleSaveGlobalGracePeriod = async () => {
        if (!user) return;
        const userId = user._id || user.id;
        if (!userId) return;

        setSaving('GLOBAL');
        try {
            await api.post(`/api/grace-period/${userId}/set-global-grace-period`, {
                gracePeriodMinutes: globalGracePeriod || 0,
            });
            await fetchUserClasses();
        } catch (err: any) {
            console.error('Error saving global grace period:', err);
            alert(err.response?.data?.msg || 'Failed to update global grace period');
        } finally {
            setSaving(null);
        }
    };

    const handleRemoveGlobalOverride = async () => {
        if (!user) return;
        const userId = user._id || user.id;
        if (!userId) return;

        setSaving('GLOBAL');
        try {
            await api.delete(`/api/grace-period/${userId}/global-grace-period`);
            await fetchUserClasses();
        } catch (err: any) {
            console.error('Error removing global override:', err);
            alert(err.response?.data?.msg || 'Failed to remove global override');
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

                {/* Global Override Section */}
                <div className="p-6 border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                        Global User Override
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Set a grace period that applies to ALL classes for this user, unless a specific class override is set.
                    </p>
                    <div className="flex items-end gap-3">
                        <div className="flex-1 max-w-xs">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Global Grace Period (Minutes)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="180"
                                value={globalGracePeriod ?? 0}
                                onChange={(e) => setGlobalGracePeriod(Math.min(180, Math.max(0, parseInt(e.target.value) || 0)))}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                                placeholder="Default"
                            />
                        </div>
                        <button
                            onClick={handleSaveGlobalGracePeriod}
                            disabled={saving === 'GLOBAL'}
                            className="px-5 py-2 bg-[#f04129] text-white rounded-lg font-medium hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving === 'GLOBAL' ? 'Saving...' : 'Save Global'}
                        </button>
                        {hasGlobalOverride && (
                            <button
                                onClick={handleRemoveGlobalOverride}
                                disabled={saving === 'GLOBAL'}
                                className="px-5 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Remove Global
                            </button>
                        )}
                    </div>
                </div>

                {/* Class Overrides Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                        Class Specific Overrides
                    </h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <svg className="animate-spin h-8 w-8 text-[#f04129]" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                            </svg>
                        </div>
                    ) : userClasses.length === 0 ? (
                        <div className="text-center py-8 px-6 bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                This user is not currently enrolled in any active classes.
                            </p>
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
                                    <div key={membership._id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-5 bg-white dark:bg-slate-800">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1">
                                                    {className}
                                                </h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    Effective: <span className="font-semibold">{currentValue} mins</span>
                                                    {' '}({source})
                                                </p>
                                            </div>
                                            {isOverride && (
                                                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-medium rounded">
                                                    Class Override
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-end gap-3">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Class Override (Minutes)
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
                                                    placeholder="Inherit"
                                                    disabled={saving === classId}
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleSaveGracePeriod(classId)}
                                                disabled={saving === classId}
                                                className="px-4 py-2 bg-gray-900 dark:bg-slate-600 text-white rounded-lg font-medium hover:bg-black dark:hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                            >
                                                {saving === classId ? 'Saving...' : 'Set Override'}
                                            </button>
                                            {isOverride && (
                                                <button
                                                    onClick={() => handleRemoveOverride(classId)}
                                                    disabled={saving === classId}
                                                    className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                >
                                                    Clear
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
