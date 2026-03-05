
import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import BulkImportStaff from '../components/BulkImportStaff';
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
import { staffService } from '../services/staffService';
import { appLogger } from '../shared/logger';

type StaffUser = {
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

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

const roleFilterToQuery = (roleFilter: string): string | undefined => {
  if (roleFilter === 'Session Admin') return 'SessionAdmin';
  if (roleFilter === 'Manager') return 'Manager';
  if (roleFilter === 'Company Admin') return 'SuperAdmin';
  return undefined;
};

const roleLabel = (role: StaffUser['role']): string => {
  if (role === 'SessionAdmin') return 'Session Admin';
  if (role === 'SuperAdmin' || role === 'CompanyAdmin') return 'Company Admin';
  return role;
};

const roleBadgeClass = (role: StaffUser['role']): string => {
  if (role === 'SessionAdmin') {
    return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800';
  }
  if (role === 'SuperAdmin' || role === 'CompanyAdmin') {
    return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800';
  }
  return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800';
};

const ManageStaff: React.FC = () => {
  const { user, isSuperAdmin, isCompanyAdmin, isPlatformOwner } = useAuth();

  const canManageQuota = isSuperAdmin || isCompanyAdmin || isPlatformOwner;
  const canAdjustGrace = isSuperAdmin || isCompanyAdmin || isPlatformOwner;
  const canDeleteStaff = isSuperAdmin;

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalStaff, setTotalStaff] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'SessionAdmin' | 'Manager'>('SessionAdmin');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [resettingDevice, setResettingDevice] = useState<string | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<string | null>(null);

  const [selectedUserForEdit, setSelectedUserForEdit] = useState<StaffUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [isGracePeriodModalOpen, setIsGracePeriodModalOpen] = useState(false);
  const [selectedStaffForGracePeriod, setSelectedStaffForGracePeriod] = useState<StaffUser | null>(null);

  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [selectedStaffForQuota, setSelectedStaffForQuota] = useState<StaffUser | null>(null);
  const [quotaForm, setQuotaForm] = useState({ pl: 12, cl: 12, sl: 10 });
  const [orgDefaults, setOrgDefaults] = useState({ pl: 12, cl: 12, sl: 10 });
  const [isSavingQuota, setIsSavingQuota] = useState(false);

  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkQuotaModalOpen, setBulkQuotaModalOpen] = useState(false);
  const [bulkGraceModalOpen, setBulkGraceModalOpen] = useState(false);
  const [bulkQuotaForm, setBulkQuotaForm] = useState({ pl: 12, cl: 12, sl: 10 });
  const [bulkQuotaResetToDefault, setBulkQuotaResetToDefault] = useState(false);
  const [bulkGraceMinutes, setBulkGraceMinutes] = useState(30);
  const [bulkGraceResetToDefault, setBulkGraceResetToDefault] = useState(false);
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);

  const getStaffId = (staff: StaffUser): string => staff._id || staff.id || '';
  const selection = useBulkSelection(staffList, getStaffId);

  const actionableSelectedIds = useMemo(
    () => selection.selectedIdsArray.filter((id) => OBJECT_ID_REGEX.test(id)),
    [selection.selectedIdsArray],
  );

  const fetchStaff = async (targetPage?: number) => {
    try {
      setIsLoading(true);
      setError('');
      const response = await staffService.fetchList<StaffUser>({
        page: targetPage ?? page,
        limit: pageSize,
        search: debouncedSearchTerm || undefined,
        role: roleFilterToQuery(roleFilter),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setStaffList(response.items || []);
      setTotalStaff(response.total || 0);
      setTotalPages(response.totalPages || 0);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('You are not authorized. Please log in again.');
      } else {
        setError('Could not fetch staff list. Please try again.');
      }
      appLogger.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrgDefaults = async () => {
    if (!canManageQuota) return;
    try {
      const { data } = await api.get('/api/organization/settings');
      setOrgDefaults({
        pl: data.yearlyQuotaPL || 12,
        cl: data.yearlyQuotaCL || 12,
        sl: data.yearlyQuotaSL || 10,
      });
    } catch (err) {
      appLogger.error('Failed to fetch organization defaults:', err);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, roleFilter, pageSize]);

  useEffect(() => {
    fetchStaff();
  }, [page, pageSize, debouncedSearchTerm, roleFilter]);

  useEffect(() => {
    fetchOrgDefaults();
  }, [canManageQuota]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const clearForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setRole('SessionAdmin');
    setError('');
    setMessage('');
  };

  const handleCreateStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const { data } = await api.post('/api/users/staff', {
        firstName,
        lastName,
        email,
        password,
        phone: phone || undefined,
        role,
      });
      setMessage(data.msg || `${role} created successfully`);
      clearForm();
      setIsCreateModalOpen(false);
      await fetchStaff();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You do not have permission to create staff members.');
      } else if (err.response?.data?.errors) {
        const errorMessages = err.response.data.errors.map((e: any) => e.msg).join(', ');
        setError(errorMessages);
      } else {
        setError(err.response?.data?.msg || 'Failed to create staff member. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSingleQuotaModal = (staff: StaffUser) => {
    setSelectedStaffForQuota(staff);
    if (staff.customLeaveQuota) {
      setQuotaForm(staff.customLeaveQuota);
    } else {
      setQuotaForm(orgDefaults);
    }
    setQuotaModalOpen(true);
  };

  const saveSingleQuota = async (resetToDefault = false) => {
    if (!selectedStaffForQuota) return;
    const staffId = getStaffId(selectedStaffForQuota);
    if (!staffId) return;

    try {
      setIsSavingQuota(true);
      await api.put(`/api/users/${staffId}/quota`, resetToDefault ? { resetToDefault: true } : quotaForm);
      setMessage(
        `${resetToDefault ? 'Leave quota reset to default' : 'Leave quota updated'} for ${selectedStaffForQuota.profile.firstName} ${selectedStaffForQuota.profile.lastName}`,
      );
      setQuotaModalOpen(false);
      setSelectedStaffForQuota(null);
      await fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to update quota');
    } finally {
      setIsSavingQuota(false);
    }
  };

  const resetDevice = async (staffId: string, deviceOnly: boolean) => {
    const confirmation = deviceOnly
      ? 'Reset this staff device ID only? Password will not change.'
      : 'Reset device ID and send a new password to this staff member?';

    if (!window.confirm(confirmation)) return;

    setResettingDevice(staffId);
    setError('');
    try {
      await api.put(`/api/users/${staffId}/${deviceOnly ? 'reset-device-only' : 'reset-device'}`);
      setMessage(deviceOnly ? 'Device ID reset successfully.' : 'Staff device reset successfully.');
      await fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to reset device.');
    } finally {
      setResettingDevice(null);
    }
  };

  const deleteSingleStaff = async (staffId: string, staffName: string) => {
    if (!window.confirm(`Delete ${staffName}? This action cannot be undone.`)) return;

    setDeletingStaff(staffId);
    setError('');
    try {
      const { data } = await api.delete(`/api/users/${staffId}`);
      setMessage(data.msg || 'Staff member deleted successfully');
      await fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to delete staff member.');
    } finally {
      setDeletingStaff(null);
    }
  };

  const showBulkResultToast = (result: { updatedCount: number; failedCount: number }, noun: string) => {
    const text = `${result.updatedCount} ${noun}${result.updatedCount === 1 ? '' : 's'} updated`;
    if (result.failedCount > 0) toast.error(`${text}, ${result.failedCount} failed`);
    else toast.success(text);
  };

  const ensureBulkSelection = (): string[] | null => {
    if (selection.selectedCount === 0) return null;
    if (actionableSelectedIds.length === 0) {
      toast.error('No valid staff records selected for this action.');
      return null;
    }
    return actionableSelectedIds;
  };

  const runBulkResetDevice = async () => {
    const ids = ensureBulkSelection();
    if (!ids) return;

    try {
      setIsBulkActionRunning(true);
      const result = await staffService.bulkResetDevice(ids);
      showBulkResultToast(result, 'staff');
      selection.clearSelection();
      await fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to reset devices');
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const runBulkDelete = async () => {
    const ids = ensureBulkSelection();
    if (!ids) return;

    try {
      setIsBulkActionRunning(true);
      const result = await staffService.bulkDelete(ids);
      showBulkResultToast(result, 'staff');
      setBulkDeleteModalOpen(false);
      selection.clearSelection();
      await fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to delete staff members');
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const runBulkQuota = async () => {
    const ids = ensureBulkSelection();
    if (!ids) return;

    try {
      setIsBulkActionRunning(true);
      const result = await staffService.bulkQuota({
        userIds: ids,
        resetToDefault: bulkQuotaResetToDefault,
        ...(bulkQuotaResetToDefault ? {} : bulkQuotaForm),
      });
      showBulkResultToast(result, 'staff');
      setBulkQuotaModalOpen(false);
      setBulkQuotaResetToDefault(false);
      selection.clearSelection();
      await fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to update leave quota');
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const runBulkGrace = async () => {
    const ids = ensureBulkSelection();
    if (!ids) return;

    try {
      setIsBulkActionRunning(true);
      const result = await staffService.bulkGrace({
        userIds: ids,
        resetToDefault: bulkGraceResetToDefault,
        ...(bulkGraceResetToDefault ? {} : { gracePeriodMinutes: bulkGraceMinutes }),
      });
      showBulkResultToast(result, 'staff');
      setBulkGraceModalOpen(false);
      setBulkGraceResetToDefault(false);
      selection.clearSelection();
      await fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.msg || 'Failed to update grace period');
    } finally {
      setIsBulkActionRunning(false);
    }
  };

  const selectedSingleStaff =
    selection.selectedCount === 1
      ? staffList.find((item) => getStaffId(item) === selection.selectedIdsArray[0]) || null
      : null;

  const bulkToolbarActions = [
    {
      id: 'edit',
      label: 'Edit',
      icon: 'edit',
      hidden: !(isSuperAdmin || isCompanyAdmin || isPlatformOwner),
      disabled: selection.selectedCount !== 1,
      title: selection.selectedCount === 1 ? '' : 'Select exactly one staff member to edit',
      onClick: () => {
        if (!selectedSingleStaff) return;
        setSelectedUserForEdit(selectedSingleStaff);
        setIsEditModalOpen(true);
      },
    },
    {
      id: 'reset-device',
      label: 'Reset Device',
      icon: 'restart_alt',
      disabled: isBulkActionRunning,
      onClick: runBulkResetDevice,
    },
    {
      id: 'manage-quota',
      label: 'Manage Leave Quota',
      icon: 'bar_chart',
      hidden: !canManageQuota,
      disabled: isBulkActionRunning,
      onClick: () => setBulkQuotaModalOpen(true),
    },
    {
      id: 'adjust-grace',
      label: 'Adjust Grace',
      icon: 'hourglass_empty',
      hidden: !canAdjustGrace,
      disabled: isBulkActionRunning,
      onClick: () => setBulkGraceModalOpen(true),
    },
    {
      id: 'delete',
      label: 'Delete Staff',
      icon: 'delete',
      hidden: !canDeleteStaff,
      danger: true,
      disabled: isBulkActionRunning,
      onClick: () => setBulkDeleteModalOpen(true),
    },
  ];

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl mx-auto">
          <ActionHeader
            title="Manage Staff"
            subtitle="Create, view, and manage staff accounts and roles."
            createLabel="Add Staff Member"
            onImportClick={() => setIsImportModalOpen(true)}
            onCreateClick={() => setIsCreateModalOpen(true)}
          />

          {message && <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-800">{message}</div>}
          {error && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800">{error}</div>}

          <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <input
                className="w-full sm:w-96 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />

              <div className="flex items-center gap-3">
                <select
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                >
                  <option value="All Roles">All Roles</option>
                  <option value="Session Admin">Session Admin</option>
                  <option value="Manager">Manager</option>
                  {(isPlatformOwner || isSuperAdmin || isCompanyAdmin) && <option value="Company Admin">Company Admin</option>}
                </select>
                <span className="text-sm text-gray-600 dark:text-gray-300">Total: {totalStaff}</span>
              </div>
            </div>
          </div>

          {selection.selectedCount > 0 && (
            <BulkActionToolbar
              selectedCount={selection.selectedCount}
              entityLabel="Staff"
              actions={bulkToolbarActions}
              onClear={selection.clearSelection}
            />
          )}
          <BulkSelectableTable
            rows={staffList}
            columns={['Name', 'Email', 'Role', 'Phone', 'Actions']}
            rowKey={getStaffId}
            selectedIds={selection.selectedIds}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            onToggleAll={selection.selectAll}
            onToggleRow={(id, index, shiftKey) => selection.toggleSelect(id, { index, shiftKey })}
            isLoading={isLoading}
            emptyMessage="No staff members found matching your criteria."
            renderRow={(staff) => {
              const staffId = getStaffId(staff);
              const staffName = `${staff.profile.firstName} ${staff.profile.lastName}`;
              const isCurrentUser = staffId === (user?.id || '');
              const isSubordinate = ['Manager', 'SessionAdmin'].includes(staff.role);
              const canResetDevice =
                isPlatformOwner || isSuperAdmin || (isCompanyAdmin && (isCurrentUser || isSubordinate));
              const showResetAction =
                (isSuperAdmin && !!staff.registeredDeviceId) ||
                (isPlatformOwner && canResetDevice) ||
                (isCompanyAdmin && canResetDevice);

              const actionItems: RowActionMenuItem[] = [
                {
                  id: 'edit',
                  label: 'Edit Profile',
                  icon: 'edit',
                  hidden: !(isSuperAdmin || isCompanyAdmin || isPlatformOwner),
                  onClick: () => {
                    setSelectedUserForEdit(staff);
                    setIsEditModalOpen(true);
                  },
                },
                {
                  id: 'quota',
                  label: 'Manage Leave Quota',
                  icon: 'bar_chart',
                  hidden: !canManageQuota,
                  onClick: () => openSingleQuotaModal(staff),
                },
                {
                  id: 'grace',
                  label: 'Adjust Grace Period',
                  icon: 'hourglass_empty',
                  hidden: !canAdjustGrace,
                  onClick: () => {
                    setSelectedStaffForGracePeriod(staff);
                    setIsGracePeriodModalOpen(true);
                  },
                },
                {
                  id: 'reset',
                  label: 'Reset Device ID',
                  icon: 'restart_alt',
                  hidden: !showResetAction,
                  disabled: resettingDevice === staffId,
                  onClick: () => resetDevice(staffId, isPlatformOwner),
                },
                {
                  id: 'delete',
                  label: 'Delete Staff',
                  icon: 'delete',
                  danger: true,
                  hidden: !canDeleteStaff || isCurrentUser,
                  disabled: deletingStaff === staffId,
                  onClick: () => deleteSingleStaff(staffId, staffName),
                },
              ];

              return (
                <>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-3">
                      {staff.profileImageUrl || staff.profilePicture ? (
                        <img
                          src={getOptimizedImageUrl(staff.profileImageUrl || staff.profilePicture, 80, 80, 'fill')}
                          alt={staffName}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                          {staff.profile.firstName?.[0]}{staff.profile.lastName?.[0]}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span>{staffName}</span>
                        {staff.registeredDeviceId && <span className="text-xs text-red-500">Device Bound</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{staff.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(staff.role)}`}>
                      {roleLabel(staff.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{staff.profile.phone || 'N/A'}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <RowActionMenu
                      menuId={staffId}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      items={actionItems}
                    />
                  </td>
                </>
              );
            }}
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {totalPages === 0 ? 0 : page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Rows</label>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || isLoading}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((prev) => (totalPages > 0 ? Math.min(totalPages, prev + 1) : prev))}
                disabled={page >= totalPages || isLoading || totalPages === 0}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          <ConfirmationModal
            isOpen={bulkDeleteModalOpen}
            title={`Delete ${selection.selectedCount} Staff${selection.selectedCount === 1 ? '' : ' Members'}?`}
            description={`You are about to delete ${selection.selectedCount} staff account${selection.selectedCount === 1 ? '' : 's'}. This action cannot be undone.`}
            confirmLabel="Delete"
            danger
            isConfirming={isBulkActionRunning}
            onCancel={() => setBulkDeleteModalOpen(false)}
            onConfirm={runBulkDelete}
          />

          {bulkQuotaModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
                <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Bulk Manage Leave Quota</h2>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">Apply quota update to {selection.selectedCount} selected staff members.</p>

                <label className="mb-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={bulkQuotaResetToDefault}
                    onChange={(event) => setBulkQuotaResetToDefault(event.target.checked)}
                  />
                  Reset selected staff to organization default quota
                </label>

                {!bulkQuotaResetToDefault && (
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    <input className="rounded border p-2" type="number" min="0" value={bulkQuotaForm.pl} onChange={(event) => setBulkQuotaForm({ ...bulkQuotaForm, pl: parseInt(event.target.value, 10) || 0 })} />
                    <input className="rounded border p-2" type="number" min="0" value={bulkQuotaForm.cl} onChange={(event) => setBulkQuotaForm({ ...bulkQuotaForm, cl: parseInt(event.target.value, 10) || 0 })} />
                    <input className="rounded border p-2" type="number" min="0" value={bulkQuotaForm.sl} onChange={(event) => setBulkQuotaForm({ ...bulkQuotaForm, sl: parseInt(event.target.value, 10) || 0 })} />
                  </div>
                )}

                <div className="flex gap-3">
                  <button className="flex-1 rounded border px-4 py-2" onClick={() => setBulkQuotaModalOpen(false)}>Cancel</button>
                  <button className="flex-1 rounded bg-[#f04129] px-4 py-2 text-white disabled:opacity-50" disabled={isBulkActionRunning} onClick={runBulkQuota}>
                    {isBulkActionRunning ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {bulkGraceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
                <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Bulk Adjust Grace Period</h2>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">Apply grace update to {selection.selectedCount} selected staff members.</p>

                <label className="mb-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={bulkGraceResetToDefault}
                    onChange={(event) => setBulkGraceResetToDefault(event.target.checked)}
                  />
                  Clear global grace override for selected staff
                </label>

                {!bulkGraceResetToDefault && (
                  <input
                    className="mb-4 w-full rounded border p-2"
                    type="number"
                    min="0"
                    max="180"
                    value={bulkGraceMinutes}
                    onChange={(event) => setBulkGraceMinutes(Math.min(180, Math.max(0, parseInt(event.target.value, 10) || 0)))}
                  />
                )}

                <div className="flex gap-3">
                  <button className="flex-1 rounded border px-4 py-2" onClick={() => setBulkGraceModalOpen(false)}>Cancel</button>
                  <button className="flex-1 rounded bg-[#f04129] px-4 py-2 text-white disabled:opacity-50" disabled={isBulkActionRunning} onClick={runBulkGrace}>
                    {isBulkActionRunning ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <EntityFormModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Staff Member">
            <form onSubmit={handleCreateStaff} className="space-y-4" autoComplete="off">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input className="rounded-lg border px-4 py-2.5" placeholder="First Name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required disabled={isSubmitting} />
                <input className="rounded-lg border px-4 py-2.5" placeholder="Last Name" value={lastName} onChange={(event) => setLastName(event.target.value)} required disabled={isSubmitting} />
              </div>

              <input className="w-full rounded-lg border px-4 py-2.5" placeholder="Email Address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={isSubmitting} />

              <select className="w-full rounded-lg border px-4 py-2.5" value={role} onChange={(event) => setRole(event.target.value as 'SessionAdmin' | 'Manager')} disabled={isSubmitting}>
                <option value="SessionAdmin">Session Admin</option>
                <option value="Manager">Manager</option>
              </select>

              <input className="w-full rounded-lg border px-4 py-2.5" placeholder="Phone (Optional)" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={isSubmitting} />

              <div className="relative">
                <input
                  className="w-full rounded-lg border py-2.5 pl-4 pr-10"
                  placeholder="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  disabled={isSubmitting}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 text-sm">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={clearForm} className="flex-1 rounded-lg border px-4 py-2.5" disabled={isSubmitting}>Clear</button>
                <button type="submit" className="flex-1 rounded-lg bg-[#f04129] px-4 py-2.5 text-white disabled:opacity-60" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </EntityFormModal>

          {quotaModalOpen && selectedStaffForQuota && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
                <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Manage Leave Quota</h2>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{selectedStaffForQuota.profile.firstName} {selectedStaffForQuota.profile.lastName}</p>

                <div className="mb-4 grid grid-cols-3 gap-2">
                  <input className="rounded border p-2" type="number" min="0" value={quotaForm.pl} onChange={(event) => setQuotaForm({ ...quotaForm, pl: parseInt(event.target.value, 10) || 0 })} />
                  <input className="rounded border p-2" type="number" min="0" value={quotaForm.cl} onChange={(event) => setQuotaForm({ ...quotaForm, cl: parseInt(event.target.value, 10) || 0 })} />
                  <input className="rounded border p-2" type="number" min="0" value={quotaForm.sl} onChange={(event) => setQuotaForm({ ...quotaForm, sl: parseInt(event.target.value, 10) || 0 })} />
                </div>

                <div className="mb-4 text-xs text-gray-500">Org default: PL {orgDefaults.pl}, CL {orgDefaults.cl}, SL {orgDefaults.sl}</div>

                <div className="flex gap-3">
                  <button className="flex-1 rounded border px-4 py-2" disabled={isSavingQuota} onClick={() => saveSingleQuota(true)}>Reset to Default</button>
                  <button className="flex-1 rounded bg-[#f04129] px-4 py-2 text-white disabled:opacity-50" disabled={isSavingQuota} onClick={() => saveSingleQuota(false)}>
                    {isSavingQuota ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <BulkImportStaff
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onSuccess={async () => {
              setPage(1);
              await fetchStaff(1);
            }}
          />

          {selectedUserForEdit && (
            <EditUserModal
              user={selectedUserForEdit}
              isOpen={isEditModalOpen}
              onClose={() => {
                setIsEditModalOpen(false);
                setSelectedUserForEdit(null);
              }}
              onSave={async () => {
                await fetchStaff();
                setIsEditModalOpen(false);
                setSelectedUserForEdit(null);
              }}
            />
          )}

          <SetGracePeriodModal
            isOpen={isGracePeriodModalOpen}
            onClose={() => {
              setIsGracePeriodModalOpen(false);
              setSelectedStaffForGracePeriod(null);
            }}
            user={selectedStaffForGracePeriod}
          />
        </div>
      </div>
    </div>
  );
};

export default ManageStaff;
