import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import api from '../api';
import ImageCropper from '../components/ImageCropper';

import { appLogger } from '../shared/logger';
const OrganizationSettings: React.FC = () => {
    const { user, isSuperAdmin, isCompanyAdmin } = useAuth();
    const { refreshOrganization } = useOrganization();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Organization Settings State
    const [organizationSettings, setOrganizationSettings] = useState({
        lateAttendanceLimit: 30,
        isStrictAttendance: false,
        yearlyQuotaPL: 12,
        yearlyQuotaCL: 12,
        yearlyQuotaSL: 10,
        emailEnabled: true,
        logo: '',
    });
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoError, setLogoError] = useState<string | null>(null);
    const [cropFile, setCropFile] = useState<File | null>(null);

    const allowedLogoTypes = ['image/jpeg', 'image/png', 'image/webp'];

    const validateLogoFile = async (file: File) => {
        if (!allowedLogoTypes.includes(file.type)) {
            return 'Only JPG, PNG, or WEBP images are allowed.';
        }
        if (file.size > 5 * 1024 * 1024) {
            return 'Logo must be less than 5MB.';
        }
        return null;
    };

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
                        emailEnabled: data.emailEnabled ?? true,
                        logo: data.logo || '',
                    });
                } catch (err: any) {
                    appLogger.error('Failed to fetch organization settings:', err);
                    // Use default values if fetch fails
                } finally {
                    setIsLoadingSettings(false);
                }
            };
            fetchOrganizationSettings();
        }
    }, [isSuperAdmin, isCompanyAdmin]);

    const handleOrganizationSettingsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingSettings(true);
        setMessage(null);

        try {
            let currentLogoUrl = organizationSettings.logo;

            // Step 1: Upload Logo if selected
            if (logoFile) {
                const formData = new FormData();
                formData.append('logo', logoFile);

                // Using the specific upload endpoint
                const uploadRes = await api.post('/api/organization/logo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (uploadRes.data.logo) {
                    currentLogoUrl = uploadRes.data.logo;
                }
            }

            // Step 2: Update other settings (and ensure logo matches)
            await api.put('/api/organization/settings', {
                lateAttendanceLimit: organizationSettings.lateAttendanceLimit,
                isStrictAttendance: organizationSettings.isStrictAttendance,
                yearlyQuotaPL: organizationSettings.yearlyQuotaPL,
                yearlyQuotaCL: organizationSettings.yearlyQuotaCL,
                yearlyQuotaSL: organizationSettings.yearlyQuotaSL,
                emailEnabled: organizationSettings.emailEnabled,
                logo: currentLogoUrl,
            });

            await refreshOrganization();

            setMessage({ type: 'success', text: 'Organization settings updated successfully!' });
            // Clear file input state
            setLogoFile(null);
            setTimeout(() => setMessage(null), 3000);
        } catch (err: any) {
            appLogger.error(err);
            setMessage({
                type: 'error',
                text: err.response?.data?.msg || 'Failed to update organization settings',
            });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLogoError(null);
        const validationError = await validateLogoFile(file);
        if (validationError) {
            setLogoError(validationError);
            setLogoFile(null);
            e.target.value = '';
            return;
        }

        setCropFile(file);
        e.target.value = ''; // Reset so the same file can be selected again
    };

    const handleCropComplete = (croppedFile: File) => {
        setLogoFile(croppedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
            setOrganizationSettings({
                ...organizationSettings,
                logo: reader.result as string, // Show preview
            });
        };
        reader.readAsDataURL(croppedFile);
        setCropFile(null);
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

            {cropFile && (
                <ImageCropper
                    imageFile={cropFile}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setCropFile(null)}
                />
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
                            {/* Organization Logo Section */}
                            <div className="p-4 rounded-lg border border-border-light dark:border-border-dark bg-background-light/30 dark:bg-background-dark/30">
                                <label className="block text-sm font-bold text-text-primary-light dark:text-text-primary-dark mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-xl">image</span>
                                    Organization Logo
                                </label>
                                <div className="flex flex-col md:flex-row items-center gap-6">
                                    <div className="relative group">
                                        <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark flex items-center justify-center overflow-hidden transition-all group-hover:border-primary">
                                            {organizationSettings.logo ? (
                                                <img
                                                    src={organizationSettings.logo}
                                                    alt="Organization Logo"
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center text-text-secondary-light dark:text-text-secondary-dark font-medium px-4 text-center">
                                                    <span className="material-symbols-outlined text-4xl mb-1">add_photo_alternate</span>
                                                    <span className="text-[10px]">No Logo</span>
                                                </div>
                                            )}
                                        </div>
                                        {organizationSettings.logo && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOrganizationSettings({ ...organizationSettings, logo: '' });
                                                    setLogoFile(null);
                                                    setLogoError(null);
                                                }}
                                                className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark max-w-sm">
                                            Upload your organization logo to customize portals and reports. Recommended size: 512x512px (PNG/JPG).
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <label className="cursor-pointer px-4 py-2 bg-text-primary-light dark:bg-text-primary-dark text-white dark:text-black rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all inline-block shadow-md">
                                                <span>{organizationSettings.logo ? 'Change Logo' : 'Choose File'}</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/png,image/jpeg,image/webp"
                                                    onChange={handleLogoChange}
                                                />
                                            </label>
                                            {organizationSettings.logo && (
                                                <p className="text-[10px] text-green-600 dark:text-green-400 font-bold flex items-center gap-1 animate-pulse">
                                                    <span className="material-symbols-outlined text-xs">check_circle</span>
                                                    Ready to Save
                                                </p>
                                            )}
                                            {logoError && (
                                                <p className="text-[11px] text-red-500 font-semibold">
                                                    {logoError}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

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

                            {/* Email Service Toggle - Platform Owner Only */}
                            {isSuperAdmin && (
                                <div className={`flex items-center justify-between p-4 rounded-lg border ${organizationSettings.emailEnabled
                                    ? 'border-border-light dark:border-border-dark'
                                    : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`material-symbols-outlined ${organizationSettings.emailEnabled
                                            ? 'text-text-secondary-light dark:text-text-secondary-dark'
                                            : 'text-red-600 dark:text-red-400'
                                            }`}>mail</span>
                                        <div>
                                            <p className={`text-sm font-medium ${organizationSettings.emailEnabled
                                                ? 'text-text-primary-light dark:text-text-primary-dark'
                                                : 'text-red-700 dark:text-red-300'
                                                }`}>
                                                Enable Email Notifications
                                            </p>
                                            <p className={`text-xs ${organizationSettings.emailEnabled
                                                ? 'text-text-secondary-light dark:text-text-secondary-dark'
                                                : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                {organizationSettings.emailEnabled
                                                    ? 'Authorized emails (Welcome, Leave) are sent normally. Password resets are always allowed.'
                                                    : '⚠️ ALL standard emails are BLOCKED. Only critical security emails (Forgot Password, Device Reset) will be sent.'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOrganizationSettings({
                                                ...organizationSettings,
                                                emailEnabled: !organizationSettings.emailEnabled,
                                            })
                                        }
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${organizationSettings.emailEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${organizationSettings.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                            )}

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
                    )
                    }
                </div >
            </div >
        </div >
    );
};

export default OrganizationSettings;
