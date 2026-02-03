import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

const OrganizationSettings: React.FC = () => {
    const { user, isSuperAdmin, isCompanyAdmin } = useAuth();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Organization Settings State
    const [organizationSettings, setOrganizationSettings] = useState({
        lateAttendanceLimit: 30,
        isStrictAttendance: false,
        yearlyQuotaPL: 12,
        yearlyQuotaCL: 12,
        yearlyQuotaSL: 10,
    });
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Fetch organization settings on mount
    useEffect(() => {
        if (isSuperAdmin || isCompanyAdmin) {
            const fetchOrganizationSettings = async () => {
                setIsLoadingSettings(true);
                try {
                    const { data } = await api.get('/api/organization/settings');
                    setOrganizationSettings({
                        lateAttendanceLimit: data.lateAttendanceLimit || 30,
                        isStrictAttendance: data.isStrictAttendance || false,
                        yearlyQuotaPL: data.yearlyQuotaPL || 12,
                        yearlyQuotaCL: data.yearlyQuotaCL || 12,
                        yearlyQuotaSL: data.yearlyQuotaSL || 10,
                    });
                } catch (err: any) {
                    console.error('Failed to fetch organization settings:', err);
                    // Use default values if fetch fails
                } finally {
                    setIsLoadingSettings(false);
                }
            };
            fetchOrganizationSettings();
        }
    }, [isSuperAdmin, isCompanyAdmin]);

    // Handle organization settings update
    const handleOrganizationSettingsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingSettings(true);
        setMessage(null);

        try {
            await api.put('/api/organization/settings', {
                lateAttendanceLimit: organizationSettings.lateAttendanceLimit,
                isStrictAttendance: organizationSettings.isStrictAttendance,
                yearlyQuotaPL: organizationSettings.yearlyQuotaPL,
                yearlyQuotaCL: organizationSettings.yearlyQuotaCL,
                yearlyQuotaSL: organizationSettings.yearlyQuotaSL,
            });

            setMessage({ type: 'success', text: 'Organization settings updated successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.msg || 'Failed to update organization settings',
            });
        } finally {
            setIsSavingSettings(false);
        }
    };

    if (!user || (!isSuperAdmin && !isCompanyAdmin)) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-text-secondary-light dark:text-text-secondary-dark">Access denied. Only Company Admins can access this page.</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10">
            {/* Page Heading */}
            <div className="mb-6">
                <h1 className="text-4xl font-black leading-tight tracking-[-0.033em] text-text-primary-light dark:text-text-primary-dark">
                    Organization Settings
                </h1>
                <p className="text-base font-normal text-text-secondary-light dark:text-text-secondary-dark mt-2">
                    Configure attendance policies and leave quotas for {user.organizationName || 'your organization'}.
                </p>
            </div>

            {/* Message Banner */}
            {message && (
                <div
                    className={`mb-6 p-4 rounded-xl border ${message.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                        }`}
                >
                    {message.text}
                </div>
            )}

            {/* Settings Form */}
            <div className="rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
                <div className="p-6">
                    {isLoadingSettings ? (
                        <div className="flex items-center justify-center py-8">
                            <svg className="animate-spin h-6 w-6 text-[#f04129]" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                            </svg>
                        </div>
                    ) : (
                        <form onSubmit={handleOrganizationSettingsSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                                    Attendance Grace Period (Minutes)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={organizationSettings.lateAttendanceLimit}
                                    onChange={(e) =>
                                        setOrganizationSettings({
                                            ...organizationSettings,
                                            lateAttendanceLimit: parseInt(e.target.value) || 0,
                                        })
                                    }
                                    className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                                    required
                                />
                                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-2">
                                    Users can mark attendance up to this many minutes after the class starts. Any attendance marked after the start time will be flagged as 'Late'.
                                </p>
                            </div>

                            {/* Strict Attendance Mode Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-lg border border-border-light dark:border-border-dark">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark">lock</span>
                                    <div>
                                        <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                                            Strict Attendance Enforcement
                                        </p>
                                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                            If enabled, users will be BLOCKED from marking attendance after the grace period. If disabled (Default), they can still mark attendance but will be flagged as 'Late'.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setOrganizationSettings({
                                            ...organizationSettings,
                                            isStrictAttendance: !organizationSettings.isStrictAttendance,
                                        })
                                    }
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${organizationSettings.isStrictAttendance ? 'bg-[#f04129]' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${organizationSettings.isStrictAttendance ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* Annual Leave Quotas Section */}
                            <div className="pt-6 border-t border-border-light dark:border-border-dark">
                                <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
                                    Annual Leave Quotas
                                </h3>
                                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-6">
                                    Set the maximum number of leave days allowed per year for each leave type.
                                </p>

                                <div className="space-y-4">
                                    {/* Personal Leave */}
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                                            Personal Leave (Days/Year)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={organizationSettings.yearlyQuotaPL}
                                            onChange={(e) =>
                                                setOrganizationSettings({
                                                    ...organizationSettings,
                                                    yearlyQuotaPL: parseInt(e.target.value) || 0,
                                                })
                                            }
                                            className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                                            required
                                        />
                                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                                            Maximum personal leave days allowed per year per employee.
                                        </p>
                                    </div>

                                    {/* Casual Leave */}
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                                            Casual Leave (Days/Year)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={organizationSettings.yearlyQuotaCL}
                                            onChange={(e) =>
                                                setOrganizationSettings({
                                                    ...organizationSettings,
                                                    yearlyQuotaCL: parseInt(e.target.value) || 0,
                                                })
                                            }
                                            className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                                            required
                                        />
                                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                                            Maximum casual leave days allowed per year per employee.
                                        </p>
                                    </div>

                                    {/* Sick Leave */}
                                    <div>
                                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                                            Sick Leave (Days/Year)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={organizationSettings.yearlyQuotaSL}
                                            onChange={(e) =>
                                                setOrganizationSettings({
                                                    ...organizationSettings,
                                                    yearlyQuotaSL: parseInt(e.target.value) || 0,
                                                })
                                            }
                                            className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                                            required
                                        />
                                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                                            Maximum sick leave days allowed per year per employee.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-6 border-t border-border-light dark:border-border-dark">
                                <button
                                    type="submit"
                                    disabled={isSavingSettings}
                                    className="flex items-center gap-2 px-6 py-2 bg-[#f04129] text-white rounded-lg font-medium hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-lg">save</span>
                                    {isSavingSettings ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrganizationSettings;
