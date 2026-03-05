import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import EditUserModal from '../components/EditUserModal';
import SetGracePeriodModal from '../components/SetGracePeriodModal';
import ActionHeader from '../components/entity/ActionHeader';
import BulkSelectableTable from '../components/entity/BulkSelectableTable';
import BulkActionToolbar from '../components/entity/BulkActionToolbar';
import RowActionMenu, { RowActionMenuItem } from '../components/entity/RowActionMenu';
import EntityFormModal from '../components/common/EntityFormModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { getOptimizedImageUrl } from '../utils/cloudinary';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { userService } from '../services/userService';

import { appLogger } from '../shared/logger';
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
  profileImageUrl?: string;
  profilePicture?: string;
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resettingDevice, setResettingDevice] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Quota management state
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [selectedUserForQuota, setSelectedUserForQuota] = useState<EndUser | null>(null);
  const [quotaForm, setQuotaForm] = useState({ pl: 12, cl: 12, sl: 10 });
  const [isSavingQuota, setIsSavingQuota] = useState(false);
  const orgDefaults = { pl: 12, cl: 12, sl: 10 };

  // Grace Period Modal State
  const [isGracePeriodModalOpen, setIsGracePeriodModalOpen] = useState(false);
  const [selectedUserForGracePeriod, setSelectedUserForGracePeriod] = useState<EndUser | null>(null);

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

  // Edit user modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<EndUser | null>(null);

  // Bulk action state
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkQuotaModalOpen, setBulkQuotaModalOpen] = useState(false);
  const [bulkGraceModalOpen, setBulkGraceModalOpen] = useState(false);
  const [bulkQuotaForm, setBulkQuotaForm] = useState({ pl: 12, cl: 12, sl: 10 });
  const [bulkQuotaResetToDefault, setBulkQuotaResetToDefault] = useState(false);
  const [bulkGraceMinutes, setBulkGraceMinutes] = useState(30);
  const [bulkGraceResetToDefault, setBulkGraceResetToDefault] = useState(false);
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);

  // Fetch existing EndUsers
  const fetchUsers = async (targetPage?: number) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await userService.fetchList<EndUser>({
        page: targetPage ?? page,
        limit: pageSize,
        search: debouncedSearchTerm || undefined,
        status: statusFilter as 'Locked' | 'Unlocked' | 'All Status',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setUsersList(response.items || []);
      setTotalUsers(response.total || 0);
      setTotalPages(response.totalPages || 0);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('You are not authorized. Please log in again.');
      } else {
        setError('Could not fetch users list. Please try again.');
      }
      appLogger.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const selection = useBulkSelection(usersList, (user) => user._id || user.id || '');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, statusFilter, pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, debouncedSearchTerm, statusFilter]);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

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
      setIsCreateModalOpen(false);
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
        const normalizeHeader = (value: string) =>
          value.toLowerCase().replace(/[\s_-]+/g, '');
        const headers = Object.keys(data[0] || {});
        const findHeader = (aliases: string[]) =>
          headers.find((h) => aliases.includes(normalizeHeader(h)));

        const nameKey = findHeader(['name', 'fullname']);
        const firstNameKey = findHeader(['firstname', 'first']);
        const lastNameKey = findHeader(['lastname', 'last']);
        const emailKey = findHeader(['email']);
        const roleKey = findHeader(['role']);
        const phoneKey = findHeader(['phonenumber', 'phone', 'mobile']);
        const addressKey = findHeader(['address']);
        const genderKey = findHeader(['gender']);
        const dobKey = findHeader(['dateofbirth', 'dob']);

        if (!emailKey || (!nameKey && (!firstNameKey || !lastNameKey))) {
          setError('CSV must contain Email and either Name or FirstName + LastName columns.');
          setIsBulkImporting(false);
          return;
        }

        const users = data
          .map((row: any) => {
            const emailValue = emailKey ? String(row[emailKey] || '').trim() : '';
            const fullName = nameKey ? String(row[nameKey] || '').trim() : '';
            const csvFirstName = firstNameKey ? String(row[firstNameKey] || '').trim() : '';
            const csvLastName = lastNameKey ? String(row[lastNameKey] || '').trim() : '';
            const resolvedName = fullName || [csvFirstName, csvLastName].filter(Boolean).join(' ').trim();
            const role = roleKey ? String(row[roleKey] || '').trim() : '';
            const phoneNumber = phoneKey ? String(row[phoneKey] || '').trim() : '';
            const address = addressKey ? String(row[addressKey] || '').trim() : '';
            const gender = genderKey ? String(row[genderKey] || '').trim() : '';
            const dateOfBirth = dobKey ? String(row[dobKey] || '').trim() : '';

            if (!resolvedName || !emailValue) {
              return null;
            }

            const tokens = resolvedName.split(/\s+/).filter(Boolean);
            const fallbackFirstName = tokens[0] || '';
            const fallbackLastName = tokens.length > 1 ? tokens.slice(1).join(' ') : 'User';

            return {
              name: resolvedName,
              firstName: csvFirstName || fallbackFirstName,
              lastName: csvLastName || fallbackLastName,
              email: emailValue,
              role,
              phoneNumber: phoneNumber || undefined,
              phone: phoneNumber || undefined,
              address: address || undefined,
              gender: gender || undefined,
              dateOfBirth: dateOfBirth || undefined,
            };
          })
          .filter(Boolean);

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

  const selectedSingleUser =
    selection.selectedCount === 1
      ? usersList.find((item) => (item._id || item.id) === selection.selectedIdsArray[0]) || null
      : null;

  const showBulkResultToast = (result: { updatedCount: number; failedCount: number }, noun: string) => {
    const updatedLabel = `${result.updatedCount} ${noun}${result.updatedCount === 1 ? '' : 's'} updated`;
    if (result.failedCount > 0) {
      toast.error(`${updatedLabel}, ${result.failedCount} failed`);
    } else {
      toast.success(updatedLabel);
    }
  };

  const runBulkResetDevice = async () => {
    if (selection.selectedCount === 0) {
      return;
    }

    try {
      setIsBulkActionRunning(true);
      const result = await userService.bulkResetDevice(selection.selectedIdsArray);
      showBulkResultToast(result, 'user');
      selection.clearSelection();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to reset devices');
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const runBulkDelete = async () => {
    if (selection.selectedCount === 0) {
      return;
    }

    try {
      setIsBulkActionRunning(true);
      const result = await userService.bulkDelete(selection.selectedIdsArray);
      showBulkResultToast(result, 'user');
      setBulkDeleteModalOpen(false);
      selection.clearSelection();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to delete users');
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const runBulkQuota = async () => {
    if (selection.selectedCount === 0) {
      return;
    }

    try {
      setIsBulkActionRunning(true);
      const result = await userService.bulkQuota({
        userIds: selection.selectedIdsArray,
        resetToDefault: bulkQuotaResetToDefault,
        ...(bulkQuotaResetToDefault ? {} : bulkQuotaForm),
      });
      showBulkResultToast(result, 'user');
      setBulkQuotaModalOpen(false);
      setBulkQuotaResetToDefault(false);
      selection.clearSelection();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to update quota');
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const runBulkGrace = async () => {
    if (selection.selectedCount === 0) {
      return;
    }

    try {
      setIsBulkActionRunning(true);
      const result = await userService.bulkGrace({
        userIds: selection.selectedIdsArray,
        resetToDefault: bulkGraceResetToDefault,
        ...(bulkGraceResetToDefault ? {} : { gracePeriodMinutes: bulkGraceMinutes }),
      });
      showBulkResultToast(result, 'user');
      setBulkGraceModalOpen(false);
      setBulkGraceResetToDefault(false);
      selection.clearSelection();
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to update grace period');
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const bulkToolbarActions = [
    {
      id: 'edit',
      label: 'Edit',
      icon: 'edit',
      onClick: () => {
        if (selectedSingleUser) {
          setSelectedUserForEdit(selectedSingleUser);
          setIsEditModalOpen(true);
        }
      },
      disabled: selection.selectedCount !== 1,
      title: selection.selectedCount === 1 ? '' : 'Select exactly one user to edit',
    },
    {
      id: 'view-attendance',
      label: 'View Attendance',
      icon: 'history',
      onClick: () => {
        if (selectedSingleUser) {
          const userId = selectedSingleUser._id || selectedSingleUser.id;
          if (userId) {
            window.open(`/admin/attendance/users/${userId}`, '_blank');
          }
        }
      },
      disabled: selection.selectedCount !== 1,
      title: selection.selectedCount === 1 ? '' : 'Select exactly one user',
    },
    {
      id: 'reset-device',
      label: 'Reset Device',
      icon: 'restart_alt',
      onClick: runBulkResetDevice,
      disabled: isBulkActionRunning,
    },
    {
      id: 'manage-quota',
      label: 'Manage Quota',
      icon: 'bar_chart',
      onClick: () => setBulkQuotaModalOpen(true),
      disabled: isBulkActionRunning || !canManageQuota,
      hidden: !canManageQuota,
    },
    {
      id: 'adjust-grace',
      label: 'Adjust Grace',
      icon: 'hourglass_empty',
      onClick: () => setBulkGraceModalOpen(true),
      disabled: isBulkActionRunning || !(isSuperAdmin || isCompanyAdmin),
      hidden: !(isSuperAdmin || isCompanyAdmin),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'delete',
      onClick: () => setBulkDeleteModalOpen(true),
      disabled: isBulkActionRunning,
      danger: true,
    },
  ];

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl mx-auto">

          <ActionHeader
            title="Manage Users"
            subtitle="Create, view, and manage user accounts and device status."
            createLabel="Create User"
            onImportClick={() => setIsImportModalOpen(true)}
            onCreateClick={() => setIsCreateModalOpen(true)}
          />

          {/* Success Message */}
          {message && (
            <div className="mb-6 bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20 p-4 rounded-xl flex items-center shadow-sm">
              <span className="material-symbols-outlined mr-2">check_circle</span>
              {message}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 p-4 rounded-xl flex items-center shadow-sm">
              <span className="material-symbols-outlined mr-2">error</span>
              {error}
            </div>
          )}

          {/* Search and Filter Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="relative w-full sm:w-96">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="h-5 w-5 text-gray-400" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" x2="16.65" y1="21" y2="16.65"></line>
                </svg>
              </div>
              <input
                className="block w-full rounded-lg border-0 py-2.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder-gray-400"
                placeholder="Search by name or email..."
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="relative w-full sm:w-48">
                <select
                  className="block w-full rounded-lg border-0 py-2.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600 appearance-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All Status">All Status</option>
                  <option value="Locked">Locked</option>
                  <option value="Unlocked">Unlocked</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path clipRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" fillRule="evenodd"></path>
                  </svg>
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap hidden sm:block">
                Total: <span className="font-semibold text-gray-900 dark:text-white">{totalUsers}</span>
              </div>
            </div>
          </div>

          {selection.selectedCount > 0 && (
            <BulkActionToolbar
              selectedCount={selection.selectedCount}
              entityLabel="User"
              actions={bulkToolbarActions}
              onClear={selection.clearSelection}
            />
          )}

          <BulkSelectableTable
            rows={usersList}
            columns={['Name', 'Email', 'Role', 'Phone', 'Actions']}
            rowKey={(user) => user._id || user.id || ''}
            selectedIds={selection.selectedIds}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            onToggleAll={selection.selectAll}
            onToggleRow={(id, index, shiftKey) => selection.toggleSelect(id, { index, shiftKey })}
            isLoading={isLoading}
            emptyMessage="No users found matching your criteria."
            renderRow={(user) => {
              const userId = user._id || user.id || '';
              const isDeviceLocked = !!user.registeredDeviceId;
              const isResetting = resettingDevice === userId;
              const isDeleting = deletingUser === userId;
              const userName = `${user.profile.firstName} ${user.profile.lastName}`;
              const canResetDevice = isSuperAdmin || isCompanyAdmin || isPlatformOwner;

              const actionItems: RowActionMenuItem[] = [
                {
                  id: 'view-attendance',
                  label: 'View Attendance',
                  icon: 'history',
                  onClick: () => window.open(`/admin/attendance/users/${userId}`, '_blank'),
                },
                {
                  id: 'edit-profile',
                  label: 'Edit Profile',
                  icon: 'edit',
                  hidden: !(isSuperAdmin || isCompanyAdmin),
                  onClick: () => {
                    setSelectedUserForEdit(user);
                    setIsEditModalOpen(true);
                  },
                },
                {
                  id: 'manage-quota',
                  label: 'Manage Quota',
                  icon: 'bar_chart',
                  hidden: !canManageQuota,
                  onClick: () => handleOpenQuotaModal(user),
                },
                {
                  id: 'reset-device',
                  label: 'Reset Device ID',
                  icon: 'restart_alt',
                  hidden: !((isSuperAdmin && isDeviceLocked) || (isPlatformOwner && canResetDevice) || (isCompanyAdmin && canResetDevice)),
                  disabled: isResetting,
                  onClick: () => {
                    if (isPlatformOwner) {
                      handleResetDeviceOnly(userId);
                    } else {
                      handleResetDevice(userId);
                    }
                  },
                },
                {
                  id: 'adjust-grace',
                  label: 'Adjust Grace Period',
                  icon: 'hourglass_empty',
                  hidden: !(isSuperAdmin || isCompanyAdmin),
                  onClick: () => {
                    setSelectedUserForGracePeriod(user);
                    setIsGracePeriodModalOpen(true);
                  },
                },
                {
                  id: 'delete',
                  label: 'Delete User',
                  icon: 'delete',
                  danger: true,
                  disabled: isDeleting,
                  onClick: () => handleDeleteUser(userId, userName),
                },
              ];

              return (
                <>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-3">
                      {user.profileImageUrl || user.profilePicture ? (
                        <img
                          src={getOptimizedImageUrl(user.profileImageUrl || user.profilePicture, 80, 80, 'fill')}
                          alt={userName}
                          className="h-8 w-8 rounded-full object-cover bg-gray-100 dark:bg-gray-800"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 font-bold text-xs">
                          {user.profile.firstName[0]}{user.profile.lastName[0]}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span>{userName}</span>
                        {isDeviceLocked && (
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <span className="material-symbols-outlined text-[14px]">lock</span>
                            Device Bound
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                      End User
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.profile.phone || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                    <RowActionMenu
                      menuId={userId}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      items={actionItems}
                    />
                  </td>
                </>
              );
            }}
          />

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {totalPages === 0 ? 0 : page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Rows</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-2 py-1"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || isLoading}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((prev) => (totalPages > 0 ? Math.min(totalPages, prev + 1) : prev))}
                disabled={page >= totalPages || isLoading || totalPages === 0}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          <ConfirmationModal
            isOpen={bulkDeleteModalOpen}
            title={`Delete ${selection.selectedCount} User${selection.selectedCount === 1 ? '' : 's'}?`}
            description={`You are about to delete ${selection.selectedCount} user account${selection.selectedCount === 1 ? '' : 's'}. This action cannot be undone.`}
            confirmLabel="Delete"
            danger
            isConfirming={isBulkActionRunning}
            onCancel={() => setBulkDeleteModalOpen(false)}
            onConfirm={runBulkDelete}
          />

          {bulkQuotaModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full max-w-[95vw] mx-4">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-[#181511] dark:text-white">
                      Bulk Manage Quota
                    </h2>
                    <button
                      onClick={() => setBulkQuotaModalOpen(false)}
                      className="text-[#8a7b60] dark:text-gray-400 hover:text-[#181511] dark:hover:text-white"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <p className="text-sm text-[#8a7b60] dark:text-gray-400 mb-4">
                    Applying leave quota update to <strong>{selection.selectedCount}</strong> selected users.
                  </p>

                  <label className="flex items-center gap-2 text-sm mb-4 text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={bulkQuotaResetToDefault}
                      onChange={(e) => setBulkQuotaResetToDefault(e.target.checked)}
                    />
                    Reset selected users to organization default quota
                  </label>

                  {!bulkQuotaResetToDefault && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#181511] dark:text-white mb-2">
                          Personal Leave (PL)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={bulkQuotaForm.pl}
                          onChange={(e) => setBulkQuotaForm({ ...bulkQuotaForm, pl: parseInt(e.target.value, 10) || 0 })}
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
                          value={bulkQuotaForm.cl}
                          onChange={(e) => setBulkQuotaForm({ ...bulkQuotaForm, cl: parseInt(e.target.value, 10) || 0 })}
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
                          value={bulkQuotaForm.sl}
                          onChange={(e) => setBulkQuotaForm({ ...bulkQuotaForm, sl: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-4 py-2 rounded-lg border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setBulkQuotaModalOpen(false)}
                      className="flex-1 px-4 py-2 rounded-lg border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#181511] dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={runBulkQuota}
                      disabled={isBulkActionRunning}
                      className="flex-1 px-4 py-2 rounded-lg bg-[#f04129] hover:bg-[#d63a25] text-white transition-colors disabled:opacity-50"
                    >
                      {isBulkActionRunning ? 'Applying...' : 'Apply to Selected'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {bulkGraceModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full max-w-[95vw] mx-4">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-[#181511] dark:text-white">
                      Bulk Adjust Grace Period
                    </h2>
                    <button
                      onClick={() => setBulkGraceModalOpen(false)}
                      className="text-[#8a7b60] dark:text-gray-400 hover:text-[#181511] dark:hover:text-white"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <p className="text-sm text-[#8a7b60] dark:text-gray-400 mb-4">
                    Applying grace period update to <strong>{selection.selectedCount}</strong> selected users.
                  </p>

                  <label className="flex items-center gap-2 text-sm mb-4 text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={bulkGraceResetToDefault}
                      onChange={(e) => setBulkGraceResetToDefault(e.target.checked)}
                    />
                    Clear global grace override for selected users
                  </label>

                  {!bulkGraceResetToDefault && (
                    <div>
                      <label className="block text-sm font-medium text-[#181511] dark:text-white mb-2">
                        Grace Period (Minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="180"
                        value={bulkGraceMinutes}
                        onChange={(e) => setBulkGraceMinutes(Math.min(180, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                        className="w-full px-4 py-2 rounded-lg border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f04129]"
                      />
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setBulkGraceModalOpen(false)}
                      className="flex-1 px-4 py-2 rounded-lg border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#181511] dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={runBulkGrace}
                      disabled={isBulkActionRunning}
                      className="flex-1 px-4 py-2 rounded-lg bg-[#f04129] hover:bg-[#d63a25] text-white transition-colors disabled:opacity-50"
                    >
                      {isBulkActionRunning ? 'Applying...' : 'Apply to Selected'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create User Modal */}
          <EntityFormModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Create New User"
          >
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                  <input
                    className="block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                    placeholder="e.g. Ramesh"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                  <input
                    className="block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                    placeholder="e.g. Deo"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                <input
                  className="block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  placeholder="e.g. ramesh.deo@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number (Optional)</label>
                <input
                  className="block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  placeholder="e.g. +91 98765 43210"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password</label>
                <div className="relative">
                  <input
                    className="block w-full rounded-lg border-0 py-2.5 pl-4 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                    placeholder="Leave empty to auto-generate"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-red-500"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={clearForm}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                  disabled={isSubmitting}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-[#f04129] text-white font-medium hover:from-orange-600 hover:to-[#d63a25] shadow-md hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </EntityFormModal>

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
                        <strong>Required:</strong> Email and either Name or FirstName + LastName.
                        <br />
                        <strong>Optional:</strong> Role, PhoneNumber, Address, Gender, DateOfBirth (YYYY-MM-DD).
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleData = [
                            ['name', 'email', 'role', 'phoneNumber', 'address', 'gender', 'dateOfBirth'],
                            ['Rahul Sharma', 'rahul.student@test.com', 'Employee', '9988776655', 'Nashik', 'Male', '1998-04-12'],
                            ['Priya Verma', 'priya.student@test.com', 'Manager', '', '', 'Female', ''],
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

          {/* Grace Period Modal */}
          <SetGracePeriodModal
            isOpen={isGracePeriodModalOpen}
            onClose={() => {
              setIsGracePeriodModalOpen(false);
              setSelectedUserForGracePeriod(null);
            }}
            user={selectedUserForGracePeriod}
          />

        </div>
      </div>
    </div>
  );
};

export default ManageUsers;
