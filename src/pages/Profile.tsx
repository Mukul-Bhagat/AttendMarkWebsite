import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

interface Organization {
  orgName: string;
  organizationId: string;
  role: string;
  userId: string;
  organizationName: string;
}

const Profile: React.FC = () => {
  const { user, refetchUser, isSuperAdmin, switchOrganization } = useAuth();
  const [activeTab, setActiveTab] = useState<'personal' | 'preferences' | 'organization'>('personal');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showOrgSwitchModal, setShowOrgSwitchModal] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Personal Details Form State
  const [personalForm, setPersonalForm] = useState({
    firstName: user?.profile.firstName || '',
    lastName: user?.profile.lastName || '',
    email: user?.email || '',
    phone: user?.profile.phone || '',
    bio: user?.profile.bio || '',
  });

  // Preferences State
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    twoFactorAuth: false,
    darkMode: localStorage.getItem('theme') === 'dark',
  });

  // Organization Settings State
  const [organizationSettings, setOrganizationSettings] = useState({
    defaultGracePeriod: 60,
    lateAttendanceLimit: 30,
    isStrictAttendance: false,
    yearlyQuotaPL: 12,
    yearlyQuotaCL: 12,
    yearlyQuotaSL: 10,
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Fetch user's organizations when modal opens
  useEffect(() => {
    if (showOrgSwitchModal) {
      const fetchOrganizations = async () => {
        setIsLoadingOrgs(true);
        try {
          const { data } = await api.get('/api/auth/my-organizations');
          setOrganizations(data.organizations || []);
        } catch (err: any) {
          console.error('Failed to fetch organizations:', err);
          setOrganizations([]);
        } finally {
          setIsLoadingOrgs(false);
        }
      };
      fetchOrganizations();
    }
  }, [showOrgSwitchModal]);

  const handleSwitchOrganization = async (organizationId: string) => {
    setIsSwitching(true);
    try {
      await switchOrganization(organizationId);
      // switchOrganization will reload the page, so we don't need to do anything else
    } catch (err: any) {
      console.error('Failed to switch organization:', err);
      alert(err.response?.data?.msg || 'Failed to switch organization. Please try again.');
      setIsSwitching(false);
    }
  };

  // Fetch organization settings on mount (if SuperAdmin)
  useEffect(() => {
    if (isSuperAdmin) {
      const fetchOrganizationSettings = async () => {
        setIsLoadingSettings(true);
        try {
          const { data } = await api.get('/api/organization/settings');
          setOrganizationSettings({
            defaultGracePeriod: data.defaultGracePeriod || 60,
            lateAttendanceLimit: data.lateAttendanceLimit || 30,
            isStrictAttendance: data.isStrictAttendance || false,
            yearlyQuotaPL: data.yearlyQuotaPL || 12,
            yearlyQuotaCL: data.yearlyQuotaCL || 12,
            yearlyQuotaSL: data.yearlyQuotaSL || 10,
          });
        } catch (err: any) {
          console.error('Failed to fetch organization settings:', err);
          // Use default value if fetch fails
        } finally {
          setIsLoadingSettings(false);
        }
      };
      fetchOrganizationSettings();
    }
  }, [isSuperAdmin]);

  // Handle organization settings update
  const handleOrganizationSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setMessage(null);

    try {
      await api.put('/api/organization/settings', {
        defaultGracePeriod: organizationSettings.defaultGracePeriod,
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

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setPersonalForm({
        firstName: user.profile.firstName || '',
        lastName: user.profile.lastName || '',
        email: user.email || '',
        phone: user.profile.phone || '',
        bio: user.profile.bio || '',
      });
    }
  }, [user]);

  // Handle profile picture upload
  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      await api.post('/api/users/profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update user in context
      await refetchUser();

      setMessage({ type: 'success', text: 'Profile picture updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.msg || 'Failed to upload profile picture',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle remove profile picture
  const handleRemoveProfilePicture = async () => {
    if (!user?.profilePicture) return;

    if (!window.confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      await api.delete('/api/users/profile-picture');

      // Update user in context
      await refetchUser();

      setMessage({ type: 'success', text: 'Profile picture removed successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.msg || 'Failed to remove profile picture',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle personal details update
  const handlePersonalDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await api.put('/api/users/profile', {
        firstName: personalForm.firstName,
        lastName: personalForm.lastName,
        phone: personalForm.phone,
        bio: personalForm.bio,
      });

      await refetchUser();
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.msg || 'Failed to update profile',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle preferences toggle
  const handlePreferenceToggle = async (key: keyof typeof preferences) => {
    const newValue = !preferences[key];
    setPreferences({ ...preferences, [key]: newValue });

    // Handle dark mode toggle
    if (key === 'darkMode') {
      const theme = newValue ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  // Get user initials
  const getUserInitials = () => {
    if (user?.profile?.firstName?.[0] && user?.profile?.lastName?.[0]) {
      return `${user.profile.firstName[0]}${user.profile.lastName[0]}`.toUpperCase();
    }
    if (user?.profile?.firstName?.[0]) {
      return user.profile.firstName[0].toUpperCase();
    }
    return 'U';
  };

  // Get role display name
  const getRoleDisplay = () => {
    if (!user?.role) return '';
    const roleMap: { [key: string]: string } = {
      'SuperAdmin': 'Company Administrator',
      'CompanyAdmin': 'Company Administrator',
      'Manager': 'Manager',
      'SessionAdmin': 'Session Administrator',
      'EndUser': 'End User',
      'PLATFORM_OWNER': 'Platform Owner',
    };
    return roleMap[user.role] || user.role;
  };

  // Format joined date
  const getJoinedDate = () => {
    if (!user?.createdAt) return 'N/A';
    try {
      return new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-secondary-light dark:text-text-secondary-dark">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-10">
      {/* Page Heading */}
      <div className="mb-6">
        <h1 className="text-4xl font-black leading-tight tracking-[-0.033em] text-text-primary-light dark:text-text-primary-dark">
          Profile & Settings
        </h1>
        <p className="text-base font-normal text-text-secondary-light dark:text-text-secondary-dark mt-2">
          Manage your personal information, security, and preferences.
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-1">
          <div className="rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
            {/* Profile Picture */}
            <div className="relative mb-6 flex justify-center">
              <div className="relative group">
                {user.profilePicture && user.profilePicture.trim() !== '' ? (
                  <img
                    key={user.profilePicture} // Force re-render when profile picture changes
                    src={`${import.meta.env.VITE_API_URL || ''}${user.profilePicture}?t=${Date.now()}`}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-[#f04129]/20"
                    onError={(e) => {
                      // Fallback to initials if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className = 'w-32 h-32 rounded-full bg-[#f04129]/20 border-4 border-[#f04129]/20 flex items-center justify-center';
                        fallback.innerHTML = `<span class="text-[#f04129] text-4xl font-bold">${getUserInitials()}</span>`;
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-[#f04129]/20 border-4 border-[#f04129]/20 flex items-center justify-center">
                    <span className="text-[#f04129] text-4xl font-bold">{getUserInitials()}</span>
                  </div>
                )}
                {/* Camera Overlay on Hover */}
                <div
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="material-symbols-outlined text-white text-3xl">camera_alt</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureUpload}
                className="hidden"
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-full">
                  <svg className="animate-spin h-6 w-6 text-[#f04129]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                  </svg>
                </div>
              )}
            </div>

            {/* Remove Profile Picture Button */}
            {user.profilePicture && user.profilePicture.trim() !== '' && (
              <div className="mb-6 flex justify-center">
                <button
                  onClick={handleRemoveProfilePicture}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                  Remove Photo
                </button>
              </div>
            )}

            {/* User Info */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-1">
                {user.profile.firstName} {user.profile.lastName}
              </h2>
              <p className="text-base text-text-secondary-light dark:text-text-secondary-dark mb-2">
                {getRoleDisplay()}
              </p>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {user.email}
              </p>
            </div>

            {/* Joined Date */}
            <div className="pt-6 border-t border-border-light dark:border-border-dark">
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
                Joined {getJoinedDate()}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Settings Tabs */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
            {/* Tab Headers */}
            <div className="flex border-b border-border-light dark:border-border-dark">
              <button
                onClick={() => setActiveTab('personal')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'personal'
                  ? 'text-[#f04129] border-b-2 border-[#f04129]'
                  : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                  }`}
              >
                Personal Details
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'preferences'
                  ? 'text-[#f04129] border-b-2 border-[#f04129]'
                  : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                  }`}
              >
                Preferences
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => setActiveTab('organization')}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'organization'
                    ? 'text-[#f04129] border-b-2 border-[#f04129]'
                    : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                    }`}
                >
                  Organization Settings
                </button>
              )}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Personal Details Tab */}
              {activeTab === 'personal' && (
                <form onSubmit={handlePersonalDetailsSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={personalForm.firstName}
                        onChange={(e) => setPersonalForm({ ...personalForm, firstName: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={personalForm.lastName}
                        onChange={(e) => setPersonalForm({ ...personalForm, lastName: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={personalForm.email}
                      disabled
                      className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-slate-100 dark:bg-slate-800 text-text-secondary-light dark:text-text-secondary-dark cursor-not-allowed"
                    />
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                      Email cannot be changed
                    </p>
                  </div>

                  {user?.organization && (
                    <div>
                      <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                        Current Organization
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={user.organization}
                          disabled
                          className="flex-1 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-slate-100 dark:bg-slate-800 text-text-secondary-light dark:text-text-secondary-dark cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOrgSwitchModal(true)}
                          className="px-4 py-2 rounded-lg bg-[#f04129] text-white font-medium hover:bg-[#d63a25] transition-colors whitespace-nowrap"
                        >
                          Switch
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={personalForm.phone}
                      onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                      Bio
                    </label>
                    <textarea
                      value={personalForm.bio}
                      onChange={(e) => setPersonalForm({ ...personalForm, bio: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2 bg-[#f04129] text-white rounded-lg font-medium hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-lg">save</span>
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  {/* Email Notifications */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark">notifications</span>
                      <div>
                        <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                          Email Notifications
                        </p>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                          Receive email updates about your account
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePreferenceToggle('emailNotifications')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences.emailNotifications ? 'bg-[#f04129]' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {/* Two-Factor Authentication */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark">security</span>
                      <div>
                        <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                          Two-Factor Authentication
                        </p>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                          Add an extra layer of security (Coming soon)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePreferenceToggle('twoFactorAuth')}
                      disabled
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors opacity-50 cursor-not-allowed ${preferences.twoFactorAuth ? 'bg-[#f04129]' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences.twoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>

                  {/* Dark Mode */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark">palette</span>
                      <div>
                        <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                          Dark Mode
                        </p>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                          Switch between light and dark theme
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePreferenceToggle('darkMode')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences.darkMode ? 'bg-[#f04129]' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences.darkMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Organization Settings Tab */}
              {activeTab === 'organization' && isSuperAdmin && (
                <form onSubmit={handleOrganizationSettingsSubmit} className="space-y-6">
                  {isLoadingSettings ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin h-6 w-6 text-[#f04129]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                      </svg>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                          Default Grace Period (Minutes)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="180"
                          step="1"
                          value={organizationSettings.defaultGracePeriod}
                          onChange={(e) => setOrganizationSettings({
                            ...organizationSettings,
                            defaultGracePeriod: Math.min(180, Math.max(0, parseInt(e.target.value) || 0)),
                          })}
                          className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                          required
                        />
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-2">
                          Organization-wide default grace period for late attendance (0-180 minutes). Classes and individual users can override this setting.
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
                          onClick={() => setOrganizationSettings({
                            ...organizationSettings,
                            isStrictAttendance: !organizationSettings.isStrictAttendance,
                          })}
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
                              onChange={(e) => setOrganizationSettings({
                                ...organizationSettings,
                                yearlyQuotaPL: parseInt(e.target.value) || 0,
                              })}
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
                              onChange={(e) => setOrganizationSettings({
                                ...organizationSettings,
                                yearlyQuotaCL: parseInt(e.target.value) || 0,
                              })}
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
                              onChange={(e) => setOrganizationSettings({
                                ...organizationSettings,
                                yearlyQuotaSL: parseInt(e.target.value) || 0,
                              })}
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
                          {isSavingSettings ? 'Saving...' : 'Save Settings'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Organization Switch Modal */}
      {showOrgSwitchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Switch Organization</h2>
              <button
                onClick={() => {
                  setShowOrgSwitchModal(false);
                  setOrganizations([]);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {isLoadingOrgs ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : organizations.filter((org) => org.organizationId !== user?.organizationId).length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-4">No other organizations available.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {organizations
                  .filter((org) => org.organizationId !== user?.organizationId)
                  .map((org) => (
                    <button
                      key={org.organizationId}
                      onClick={() => handleSwitchOrganization(org.organizationId)}
                      disabled={isSwitching}
                      className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {org.organizationName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {org.role}
                        </span>
                      </div>
                      {isSwitching ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      ) : (
                        <span className="material-symbols-outlined text-gray-400">arrow_forward</span>
                      )}
                    </button>
                  ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowOrgSwitchModal(false);
                  setOrganizations([]);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

