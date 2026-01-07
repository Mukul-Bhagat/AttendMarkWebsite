import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import Papa from 'papaparse';
import EditUserModal from '../components/EditUserModal';

type EndUser = {
  _id?: string;
  id?: string;
  email: string;
  role: 'SuperAdmin' | 'CompanyAdmin' | 'Manager' | 'SessionAdmin' | 'EndUser' | 'PLATFORM_OWNER';
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
  };
  registeredDeviceId?: string;
  customLeaveQuota?: {
    pl: number;
    cl: number;
    sl: number;
  } | null;
};

const ManageUsers: React.FC = () => {
  const { isSuperAdmin, isCompanyAdmin, isPlatformOwner } = useAuth();
  const canManageQuota = isSuperAdmin || isCompanyAdmin;

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  // Page state
  const [usersList, setUsersList] = useState<EndUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resettingDevice, setResettingDevice] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');

  // Quota management state
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [selectedUserForQuota, setSelectedUserForQuota] = useState<EndUser | null>(null);
  const [quotaForm, setQuotaForm] = useState({ pl: 12, cl: 12, sl: 10 });
  const [isSavingQuota, setIsSavingQuota] = useState(false);
  const orgDefaults = { pl: 12, cl: 12, sl: 10 };

  // Bulk import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [useRandomPassword, setUseRandomPassword] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dropdown menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Edit user modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<EndUser | null>(null);

  // Fetch existing EndUsers
  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError('');
      const { data } = await api.get('/api/users/my-organization');
      // Filter for EndUser role only
      const endUsers = data.filter((user: EndUser) => user.role === 'EndUser');
      setUsersList(endUsers);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('You are not authorized. Please log in again.');
      } else {
        setError('Could not fetch users list. Please try again.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Click outside handler for dropdown menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        const menuElement = menuRefs.current[openMenuId];
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  const clearForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setMessage('');
    setError('');
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    const userData = {
      firstName,
      lastName,
      email,
      password,
      phone: phone || undefined,
    };

    try {
      const { data } = await api.post('/api/users/end-user', userData);

      setMessage(data.msg || 'EndUser created successfully');
      clearForm();
      // Refresh the list immediately
      await fetchUsers();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You do not have permission to create users.');
      } else if (err.response?.data?.errors) {
        const errorMessages = err.response.data.errors.map((e: any) => e.msg).join(', ');
        setError(errorMessages);
      } else {
        setError(err.response?.data?.msg || 'Failed to create user. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle device reset
  const handleResetDevice = async (userId: string) => {
    if (!window.confirm('This will reset the device ID and send a new 6-digit password to the user\'s email. Continue?')) {
      return;
    }

    setResettingDevice(userId);
    setError('');
    setMessage('');

    try {
      await api.put(`/api/users/${userId}/reset-device`);

      setMessage('Device reset successfully! A new password has been generated and emailed to the user.');
      // Refresh the list to show updated device status
      await fetchUsers();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You do not have permission to reset devices.');
      } else {
        setError(err.response?.data?.msg || 'Failed to reset device. Please try again.');
      }
    } finally {
      setResettingDevice(null);
    }
  };

  // Handle device reset (Platform Owner only - without password reset)
  const handleResetDeviceOnly = async (userId: string) => {
    if (!window.confirm('Are you sure you want to reset this user\'s device ID? This will allow them to register a new device without changing their password.')) {
      return;
    }

    setResettingDevice(userId);
    setError('');
    setMessage('');

    try {
      await api.put(`/api/users/${userId}/reset-device-only`);

      setMessage('Device ID reset successfully! User can now register a new device.');
      // Refresh the list to show updated device status
      await fetchUsers();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You do not have permission to reset devices.');
      } else {
        setError(err.response?.data?.msg || 'Failed to reset device. Please try again.');
      }
    } finally {
      setResettingDevice(null);
    }
  };

  // Handle CSV file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setCsvFile(file);
    setError('');

    // Parse CSV to preview
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        setCsvPreview(data.slice(0, 5)); // Show first 5 rows as preview
      },
      error: (error) => {
        setError(`Error parsing CSV: ${error.message}`);
        setCsvFile(null);
      },
    });
  };

  // Handle bulk import
  const handleBulkImport = async () => {
    if (!csvFile) {
      setError('Please select a CSV file');
      return;
    }

    if (!useRandomPassword && (!temporaryPassword || temporaryPassword.length < 6)) {
      setError('Please enter a temporary password (min 6 characters) or enable random password generation');
      return;
    }

    setIsBulkImporting(true);
    setError('');
    setMessage('');

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];

        // Validate headers
        const headers = Object.keys(data[0] || {});
        const hasFirstName = headers.some(h => h.toLowerCase() === 'firstname');
        const hasLastName = headers.some(h => h.toLowerCase() === 'lastname');
        const hasEmail = headers.some(h => h.toLowerCase() === 'email');

        if (!hasFirstName || !hasLastName || !hasEmail) {
          setError('CSV must contain "FirstName", "LastName", and "Email" columns. Phone is optional.');
          setIsBulkImporting(false);
          return;
        }

        // Transform data to match backend format
        // Note: Role column is optional - if missing, backend will default to 'EndUser'
        const users = data.map((row: any) => {
          const firstNameKey = headers.find(h => h.toLowerCase() === 'firstname') || 'FirstName';
          const lastNameKey = headers.find(h => h.toLowerCase() === 'lastname') || 'LastName';
          const emailKey = headers.find(h => h.toLowerCase() === 'email') || 'Email';
          const roleKey = headers.find(h => h.toLowerCase() === 'role'); // Optional - may not exist
          const phoneKey = headers.find(h => h.toLowerCase() === 'phone'); // Optional

          const userObj: any = {
            firstName: row[firstNameKey]?.trim() || '',
            lastName: row[lastNameKey]?.trim() || '',
            email: row[emailKey]?.trim() || '',
            phone: phoneKey ? (row[phoneKey]?.trim() || '') : '',
          };

          // Only include role if the column exists
          if (roleKey) {
            userObj.role = row[roleKey]?.trim() || '';
          }

          return userObj;
        }).filter(user => user.firstName && user.lastName && user.email); // Filter out empty rows

        if (users.length === 0) {
          setError('No valid users found in CSV file');
          setIsBulkImporting(false);
          return;
        }

        try {
          const { data: response } = await api.post('/api/users/bulk', {
            users,
            temporaryPassword: useRandomPassword ? undefined : temporaryPassword,
            useRandomPassword,
          });

          setMessage(response.msg || `Successfully imported ${response.successCount} users`);
          setIsImportModalOpen(false);
          setCsvFile(null);
          setTemporaryPassword('');
          setCsvPreview([]);
          await fetchUsers();
        } catch (err: any) {
          if (err.response?.data?.errors) {
            const errorMessages = err.response.data.errors.slice(0, 10).join(', ');
            setError(`${err.response.data.msg || 'Bulk import failed'}. Errors: ${errorMessages}${err.response.data.errors.length > 10 ? '...' : ''}`);
          } else {
            setError(err.response?.data?.msg || 'Failed to import users. Please try again.');
          }
        } finally {
          setIsBulkImporting(false);
        }
      },
      error: (error) => {
        setError(`Error parsing CSV: ${error.message}`);
        setIsBulkImporting(false);
      },
    });
  };

  // Handle quota management
  const handleOpenQuotaModal = async (user: EndUser) => {
    setSelectedUserForQuota(user);
    // Pre-fill with current custom quota or org defaults
    if (user.customLeaveQuota) {
      setQuotaForm({
        pl: user.customLeaveQuota.pl,
        cl: user.customLeaveQuota.cl,
        sl: user.customLeaveQuota.sl,
      });
    } else {
      setQuotaForm({
        pl: orgDefaults.pl,
        cl: orgDefaults.cl,
        sl: orgDefaults.sl,
      });
    }
    setQuotaModalOpen(true);
  };

  const handleCloseQuotaModal = () => {
    setQuotaModalOpen(false);
    setSelectedUserForQuota(null);
    setQuotaForm({ pl: 12, cl: 12, sl: 10 });
  };

  const handleSaveQuota = async () => {
    if (!selectedUserForQuota) return;

    try {
      setIsSavingQuota(true);
      const userId = selectedUserForQuota._id || selectedUserForQuota.id;
      await api.put(`/api/users/${userId}/quota`, quotaForm);

      setMessage(`Leave quota updated for ${selectedUserForQuota.profile.firstName} ${selectedUserForQuota.profile.lastName}`);
      handleCloseQuotaModal();
      fetchUsers(); // Refresh user list
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to update quota');
    } finally {
      setIsSavingQuota(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!selectedUserForQuota) return;

    try {
      setIsSavingQuota(true);
      const userId = selectedUserForQuota._id || selectedUserForQuota.id;
      await api.put(`/api/users/${userId}/quota`, { resetToDefault: true });

      setMessage(`Leave quota reset to default for ${selectedUserForQuota.profile.firstName} ${selectedUserForQuota.profile.lastName}`);
      handleCloseQuotaModal();
      fetchUsers(); // Refresh user list
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to reset quota');
    } finally {
      setIsSavingQuota(false);
    }
  };

  // Handle user deletion (SuperAdmin only)
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingUser(userId);
    setError('');
    setMessage('');

    try {
      const { data } = await api.delete(`/api/users/${userId}`);

      setMessage(data.msg || 'User deleted successfully');
      // Refresh the list
      await fetchUsers();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You do not have permission to delete users.');
      } else {
        setError(err.response?.data?.msg || 'Failed to delete user. Please try again.');
      }
    } finally {
      setDeletingUser(null);
    }
  };

  // Filter users based on search term and status
  const filteredUsers = usersList.filter((user) => {
    const userName = `${user.profile.firstName} ${user.profile.lastName}`.toLowerCase();
    const userEmail = user.email.toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    // Search filter: check if name or email includes search term
    const matchesSearch = !searchTerm ||
      userName.includes(searchLower) ||
      userEmail.includes(searchLower);

    // Status filter: check if device is locked/unlocked
    const isDeviceLocked = !!user.registeredDeviceId;
    const matchesStatus = statusFilter === 'All Status' ||
      (statusFilter === 'Locked' && isDeviceLocked) ||
      (statusFilter === 'Unlocked' && !isDeviceLocked);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex flex-1 justify-center">
          <div className="layout-content-container flex flex-col w-full max-w-7xl flex-1">
            <div className="flex min-w-72 flex-col gap-3 mb-8">
              <p className="text-[#181511] dark:text-white text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em]">Manage Users</p>
              <p className="text-[#8a7b60] dark:text-gray-400 text-base font-normal leading-normal">Create, view, and manage user accounts and device status.</p>
            </div>

            {/* Success Message */}
            {message && (
              <div className="mb-6 bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20 p-4 rounded-xl flex items-center">
                <span className="material-symbols-outlined mr-2">check_circle</span>
                {message}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 p-4 rounded-xl flex items-center">
                <span className="material-symbols-outlined mr-2">error</span>
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-8 w-8 text-[#f04129] mb-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                  </svg>
                  <p className="text-[#8a7b60] dark:text-gray-400">Loading users list...</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create User Form */}
                <div className="lg:col-span-1 lg:sticky lg:top-8 lg:self-start">
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-[#181511] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">
                        <span className="material-symbols-outlined text-[#f04129] mr-2 inline-block align-middle">person_add</span>
                        <span className="align-middle">Add New User</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#f04129] border border-[#f04129] rounded-lg hover:bg-[#f04129]/10 dark:hover:bg-[#f04129]/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">upload_file</span>
                        Import CSV
                      </button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                          <p className="text-[#181511] dark:text-gray-200 text-sm font-medium leading-normal mb-1">First Name</p>
                          <input
                            className="form-input w-full rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-10 px-3 text-sm font-normal leading-normal placeholder:text-[#8a7b60] dark:placeholder-gray-400"
                            placeholder="Ramesh"
                            type="text"
                            value={firstName}
                            onChange={(e) => {
                              setFirstName(e.target.value);
                              if (error) setError('');
                            }}
                            required
                            disabled={isSubmitting}
                          />
                        </label>
                        <label className="block">
                          <p className="text-[#181511] dark:text-gray-200 text-sm font-medium leading-normal mb-1">Last Name</p>
                          <input
                            className="form-input w-full rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-10 px-3 text-sm font-normal leading-normal placeholder:text-[#8a7b60] dark:placeholder-gray-400"
                            placeholder="Deo"
                            type="text"
                            value={lastName}
                            onChange={(e) => {
                              setLastName(e.target.value);
                              if (error) setError('');
                            }}
                            required
                            disabled={isSubmitting}
                          />
                        </label>
                      </div>

                      <label className="block">
                        <p className="text-[#181511] dark:text-gray-200 text-sm font-medium leading-normal mb-1">Email</p>
                        <input
                          className="form-input w-full rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-10 px-3 text-sm font-normal leading-normal placeholder:text-[#8a7b60] dark:placeholder-gray-400"
                          placeholder="ramesh.deo@example.com"
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (error) setError('');
                          }}
                          required
                          disabled={isSubmitting}
                        />
                      </label>

                      <label className="block">
                        <p className="text-[#181511] dark:text-gray-200 text-sm font-medium leading-normal mb-1">Temporary Password</p>
                        <div className="relative">
                          <input
                            className="form-input w-full rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-10 px-3 pr-10 text-sm font-normal leading-normal placeholder:text-[#8a7b60] dark:placeholder-gray-400"
                            placeholder="Min 6 characters"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (error) setError('');
                            }}
                            minLength={6}
                            required
                            disabled={isSubmitting}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#8a7b60] dark:text-gray-400 hover:text-[#f04129] z-10 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-lg">
                              {showPassword ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                        <p className="text-xs text-[#8a7b60] dark:text-gray-500 mt-1">Min 6 characters</p>
                      </label>

                      <label className="block">
                        <p className="text-[#181511] dark:text-gray-200 text-sm font-medium leading-normal mb-1">Phone (Optional)</p>
                        <input
                          className="form-input w-full rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-10 px-3 text-sm font-normal leading-normal placeholder:text-[#8a7b60] dark:placeholder-gray-400"
                          placeholder="+91 98765 43210"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </label>

                      <div className="pt-2 space-y-3">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-[#f04129] py-3 px-4 font-semibold text-white transition-all duration-200 hover:from-orange-600 hover:to-[#d63a25] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <span className="material-symbols-outlined mr-2 text-xl">person_add</span>
                          {isSubmitting ? 'Creating...' : 'Create User'}
                        </button>
                        <button
                          type="button"
                          onClick={clearForm}
                          disabled={isSubmitting}
                          className="w-full text-center text-sm text-[#8a7b60] dark:text-gray-400 hover:text-[#181511] dark:hover:text-white transition-colors duration-200 disabled:opacity-50"
                        >
                          Clear Form
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Users Table */}
                <div className="lg:col-span-2">
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                      <h2 className="text-xl text-[#181511] dark:text-white font-bold flex items-center shrink-0">
                        End Users
                        <span className="ml-3 px-3 py-1 bg-red-100 text-[#f04129] dark:bg-[#f04129]/20 dark:text-[#f04129] rounded-full text-sm font-semibold">
                          {usersList.length}
                        </span>
                      </h2>
                      <div className="flex w-full sm:w-auto items-center gap-4">
                        <div className="relative w-full sm:w-64">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <svg className="h-5 w-5 text-[#8a7b60] dark:text-gray-400" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="11" cy="11" r="8"></circle>
                              <line x1="21" x2="16.65" y1="21" y2="16.65"></line>
                            </svg>
                          </div>
                          <input
                            className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-10 pl-10 pr-3 text-sm font-normal leading-normal placeholder:text-[#8a7b60] dark:placeholder-gray-400"
                            placeholder="Search by name or email..."
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <div className="relative">
                          <select
                            className="form-select w-full appearance-none rounded-lg border border-[#e6e2db] dark:border-slate-600 bg-white dark:bg-slate-800 py-2 pl-3 pr-8 text-sm text-[#181511] dark:text-white focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-[#f04129] dark:focus:border-primary/50"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                          >
                            <option value="All Status">All Status</option>
                            <option value="Locked">Locked</option>
                            <option value="Unlocked">Unlocked</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#8a7b60] dark:text-gray-400">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                              <path clipRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" fillRule="evenodd"></path>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {usersList.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-[#8a7b60] dark:text-gray-400 text-base mb-2">No end users found.</p>
                        <p className="text-[#8a7b60] dark:text-gray-400 text-sm">Create your first end user using the form above.</p>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-[#8a7b60] dark:text-gray-400 text-base mb-2">No matching records found.</p>
                        <p className="text-[#8a7b60] dark:text-gray-400 text-sm">Try adjusting your search or filter criteria.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="border-b border-[#e6e2db] dark:border-white/10">
                            <tr>
                              <th className="px-6 py-2 text-left text-xs font-medium text-[#8a7b60] dark:text-gray-300 uppercase tracking-wider" scope="col">Name</th>
                              <th className="px-6 py-2 text-left text-xs font-medium text-[#8a7b60] dark:text-gray-300 uppercase tracking-wider" scope="col">Email</th>
                              <th className="px-6 py-2 text-left text-xs font-medium text-[#8a7b60] dark:text-gray-300 uppercase tracking-wider" scope="col">Phone</th>
                              {(isSuperAdmin || canManageQuota || isPlatformOwner) && (
                                <th className="px-6 py-2 text-left text-xs font-medium text-[#8a7b60] dark:text-gray-300 uppercase tracking-wider w-16" scope="col">Actions</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#e6e2db] dark:divide-white/10">
                            {filteredUsers.map((user) => {
                              const userId = user._id || user.id || '';
                              const isDeviceLocked = !!user.registeredDeviceId;
                              const isResetting = resettingDevice === userId;
                              const isDeleting = deletingUser === userId;
                              const userName = `${user.profile.firstName} ${user.profile.lastName}`;

                              // Determine if current user can reset this user's device
                              // SuperAdmin, CompanyAdmin, and Platform Owner can reset EndUsers
                              const canResetDevice = isSuperAdmin || isCompanyAdmin || isPlatformOwner;

                              return (
                                <tr key={userId} className="hover:bg-red-50 dark:hover:bg-[#f04129]/10 transition-colors duration-150">
                                  <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-[#181511] dark:text-white">
                                    <div className="flex items-center gap-2">
                                      <span>{userName}</span>
                                      {isDeviceLocked && (
                                        <span
                                          className="material-symbols-outlined text-red-600 dark:text-red-400 text-sm cursor-help"
                                          title="Account Locked / Device Bound"
                                        >
                                          lock
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-sm text-[#8a7b60] dark:text-gray-400">
                                    {user.email}
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-sm text-[#8a7b60] dark:text-gray-400">
                                    {user.profile.phone || 'N/A'}
                                  </td>
                                  {(isSuperAdmin || canManageQuota || isPlatformOwner) && (
                                    <td className="px-6 py-2 whitespace-nowrap text-sm font-medium w-16">
                                      <div className="relative" ref={(el) => { menuRefs.current[userId] = el; }}>
                                        <button
                                          onClick={() => setOpenMenuId(openMenuId === userId ? null : userId)}
                                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 p-2 rounded-full transition-colors"
                                          title="Settings"
                                        >
                                          <span className="material-symbols-outlined text-xl">more_vert</span>
                                        </button>

                                        {openMenuId === userId && (
                                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50">
                                            <ul className="py-1">
                                              {/* 1. Edit Profile */}
                                              {(isSuperAdmin || isCompanyAdmin) && (
                                                <li>
                                                  <button
                                                    onClick={() => {
                                                      setOpenMenuId(null);
                                                      setSelectedUserForEdit(user);
                                                      setIsEditModalOpen(true);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                                  >
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                    <span>Edit Profile</span>
                                                  </button>
                                                </li>
                                              )}

                                              {/* 2. Manage Leave Quota */}
                                              {canManageQuota && (
                                                <li>
                                                  <button
                                                    onClick={() => {
                                                      setOpenMenuId(null);
                                                      handleOpenQuotaModal(user);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                                  >
                                                    <span className="material-symbols-outlined text-lg">bar_chart</span>
                                                    <span>Manage Leave Quota</span>
                                                  </button>
                                                </li>
                                              )}

                                              {/* 3. Reset Device ID: Show for SuperAdmin, CompanyAdmin, or Platform Owner */}
                                              {canResetDevice && (
                                                <li>
                                                  <button
                                                    onClick={() => {
                                                      setOpenMenuId(null);
                                                      // Platform Owner uses reset-device-only, others use reset-device
                                                      if (isPlatformOwner) {
                                                        handleResetDeviceOnly(userId);
                                                      } else {
                                                        handleResetDevice(userId);
                                                      }
                                                    }}
                                                    disabled={isResetting}
                                                    className="w-full text-left px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                  >
                                                    {isResetting ? (
                                                      <>
                                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                          <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                                                        </svg>
                                                        <span>Resetting...</span>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <span className="material-symbols-outlined text-lg">restart_alt</span>
                                                        <span>Reset Device ID</span>
                                                      </>
                                                    )}
                                                  </button>
                                                </li>
                                              )}

                                              {/* 4. Delete User: Only show for SuperAdmin */}
                                              {isSuperAdmin && (
                                                <li>
                                                  <button
                                                    onClick={() => {
                                                      setOpenMenuId(null);
                                                      handleDeleteUser(userId, userName);
                                                    }}
                                                    disabled={isDeleting}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                  >
                                                    {isDeleting ? (
                                                      <>
                                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                          <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                                                        </svg>
                                                        <span>Deleting...</span>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                        <span>Delete User</span>
                                                      </>
                                                    )}
                                                  </button>
                                                </li>
                                              )}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-[#e6e2db] dark:border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-[#e6e2db] dark:border-slate-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#181511] dark:text-white flex items-center">
                <span className="material-symbols-outlined text-[#f04129] mr-2">upload_file</span>
                Bulk Import Users via CSV
              </h3>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvFile(null);
                  setTemporaryPassword('');
                  setUseRandomPassword(false);
                  setCsvPreview([]);
                  setError('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-[#8a7b60] dark:text-gray-400 hover:text-[#181511] dark:hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Content - Split View */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Side - File Upload */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-[#181511] dark:text-white">CSV File</h4>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${csvFile
                    ? 'border-[#f04129] bg-[#f04129]/5 dark:bg-[#f04129]/10'
                    : 'border-[#e6e2db] dark:border-slate-700 hover:border-[#f04129] dark:hover:border-[#f04129]'
                    }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file && file.name.endsWith('.csv')) {
                      setCsvFile(file);
                      Papa.parse(file, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                          const data = results.data as any[];
                          setCsvPreview(data.slice(0, 5));
                        },
                        error: (error) => {
                          setError(`Error parsing CSV: ${error.message}`);
                          setCsvFile(null);
                        },
                      });
                    } else {
                      setError('Please drop a CSV file');
                    }
                  }}
                >
                  {csvFile ? (
                    <div className="space-y-2">
                      <span className="material-symbols-outlined text-4xl text-[#f04129]">description</span>
                      <p className="text-sm font-medium text-[#181511] dark:text-white">{csvFile.name}</p>
                      <p className="text-xs text-[#8a7b60] dark:text-gray-400">{(csvFile.size / 1024).toFixed(2)} KB</p>
                      <button
                        type="button"
                        onClick={() => {
                          setCsvFile(null);
                          setCsvPreview([]);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="material-symbols-outlined text-4xl text-[#8a7b60] dark:text-gray-400">cloud_upload</span>
                      <p className="text-sm text-[#181511] dark:text-white">Drag & drop CSV file here</p>
                      <p className="text-xs text-[#8a7b60] dark:text-gray-400">or</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 text-sm font-medium text-[#f04129] border border-[#f04129] rounded-lg hover:bg-[#f04129]/10 dark:hover:bg-[#f04129]/20 transition-colors"
                      >
                        Choose File
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">CSV Format Requirements:</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                    <strong>Required Columns:</strong> FirstName, LastName, Email, Phone (optional).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const sampleData = [
                        ['FirstName', 'LastName', 'Email', 'Phone'],
                        ['Rahul', 'Sharma', 'rahul.student@test.com', '9988776655'],
                        ['Priya', 'Verma', 'priya.student@test.com', '8877665544'],
                      ];
                      const csvContent = sampleData.map(row => row.join(',')).join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      const url = URL.createObjectURL(blob);
                      link.setAttribute('href', url);
                      link.setAttribute('download', 'user_import_sample.csv');
                      link.style.visibility = 'hidden';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="mt-2 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Download User Sample CSV
                  </button>
                </div>

                {/* CSV Preview */}
                {csvPreview.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-[#181511] dark:text-white mb-2">Preview (first 5 rows):</p>
                    <div className="overflow-x-auto border border-[#e6e2db] dark:border-slate-700 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead className="bg-[#f04129]/10">
                          <tr>
                            {Object.keys(csvPreview[0] || {}).map((key) => (
                              <th key={key} className="px-2 py-1 text-left font-medium text-[#181511] dark:text-white">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e6e2db] dark:divide-slate-700">
                          {csvPreview.map((row, idx) => (
                            <tr key={idx}>
                              {Object.values(row).map((val: any, i) => (
                                <td key={i} className="px-2 py-1 text-[#8a7b60] dark:text-gray-400">
                                  {String(val || '').slice(0, 30)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side - Credentials */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-[#181511] dark:text-white">Credentials</h4>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useRandomPassword}
                      onChange={(e) => {
                        setUseRandomPassword(e.target.checked);
                        if (e.target.checked) {
                          setTemporaryPassword('');
                        }
                        if (error) setError('');
                      }}
                      className="w-4 h-4 text-primary bg-white border-[#e6e2db] dark:border-slate-700 rounded focus:ring-2 focus:ring-primary dark:bg-slate-900 dark:checked:bg-primary"
                    />
                    <span className="text-sm font-medium text-[#181511] dark:text-gray-200">
                      Auto-generate random 6-character password for each user
                    </span>
                  </label>

                  <label className="flex flex-col">
                    <p className="text-[#181511] dark:text-gray-200 text-sm font-medium leading-normal pb-2">
                      Temporary Password for All Users
                    </p>
                    <input
                      type="password"
                      value={temporaryPassword}
                      onChange={(e) => {
                        setTemporaryPassword(e.target.value);
                        if (error) setError('');
                      }}
                      disabled={useRandomPassword}
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-12 p-3 text-base font-normal leading-normal placeholder:text-[#8a7b60] dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800"
                      placeholder="Min 6 characters"
                      minLength={6}
                      required={!useRandomPassword}
                    />
                    <p className="text-xs text-[#8a7b60] dark:text-gray-500 mt-1.5">
                      {useRandomPassword
                        ? 'Each user will receive a unique random 6-character password via email. Users will be required to change it on first login.'
                        : 'This password will be applied to every account in the uploaded file. Users will be required to change it on first login.'}
                    </p>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-[#e6e2db] dark:border-slate-700 px-6 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvFile(null);
                  setTemporaryPassword('');
                  setUseRandomPassword(false);
                  setCsvPreview([]);
                  setError('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                disabled={isBulkImporting}
                className="px-4 py-2 text-sm font-medium text-[#8a7b60] dark:text-gray-400 hover:text-[#181511] dark:hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={!csvFile || (!useRandomPassword && (!temporaryPassword || temporaryPassword.length < 6)) || isBulkImporting}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-[#f04129] text-white rounded-lg font-semibold transition-all duration-200 hover:from-orange-600 hover:to-[#d63a25] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBulkImporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">upload_file</span>
                    Upload & Create Users
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quota Management Modal */}
      {quotaModalOpen && selectedUserForQuota && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full max-w-[95vw] mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#181511] dark:text-white">
                  Manage Leave Quota
                </h2>
                <button
                  onClick={handleCloseQuotaModal}
                  className="text-[#8a7b60] dark:text-gray-400 hover:text-[#181511] dark:hover:text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <p className="text-sm text-[#8a7b60] dark:text-gray-400 mb-4">
                Setting custom leave quotas for <strong>{selectedUserForQuota.profile.firstName} {selectedUserForQuota.profile.lastName}</strong>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#181511] dark:text-white mb-2">
                    Personal Leave (PL)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quotaForm.pl}
                    onChange={(e) => setQuotaForm({ ...quotaForm, pl: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#181511] dark:text-white mb-2">
                    Casual Leave (CL)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quotaForm.cl}
                    onChange={(e) => setQuotaForm({ ...quotaForm, cl: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#181511] dark:text-white mb-2">
                    Sick Leave (SL)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quotaForm.sl}
                    onChange={(e) => setQuotaForm({ ...quotaForm, sl: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                  />
                </div>

                {selectedUserForQuota.customLeaveQuota && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      This user currently has custom quotas. Organization default: PL: {orgDefaults.pl}, CL: {orgDefaults.cl}, SL: {orgDefaults.sl}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleResetToDefault}
                  disabled={isSavingQuota}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#181511] dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Reset to Default
                </button>
                <button
                  onClick={handleSaveQuota}
                  disabled={isSavingQuota}
                  className="flex-1 px-4 py-2 rounded-lg bg-[#f04129] hover:bg-[#d63a25] text-white transition-colors disabled:opacity-50"
                >
                  {isSavingQuota ? 'Saving...' : 'Save Quota'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      <EditUserModal
        user={selectedUserForEdit}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUserForEdit(null);
        }}
        onSave={async () => {
          await fetchUsers();
          setIsEditModalOpen(false);
          setSelectedUserForEdit(null);
        }}
      />
    </div>
  );
};

export default ManageUsers;

