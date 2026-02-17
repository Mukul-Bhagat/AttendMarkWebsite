import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import BulkImportStaff from '../components/BulkImportStaff';
import EditUserModal from '../components/EditUserModal';
import ActionHeader from '../components/entity/ActionHeader';
import EntityTable from '../components/entity/EntityTable';
import EntityFormModal from '../components/common/EntityFormModal';
import { getOptimizedImageUrl } from '../utils/cloudinary';

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

const ManageStaff: React.FC = () => {
  const { user, isSuperAdmin, isCompanyAdmin, isPlatformOwner } = useAuth();
  const canManageQuota = isSuperAdmin || isCompanyAdmin || isPlatformOwner;

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'SessionAdmin' | 'Manager'>('SessionAdmin');

  const [showPassword, setShowPassword] = useState(false);

  // Page state
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [resettingDevice, setResettingDevice] = useState<string | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');

  // Quota management state
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [selectedStaffForQuota, setSelectedStaffForQuota] = useState<StaffUser | null>(null);
  const [quotaForm, setQuotaForm] = useState({ pl: 12, cl: 12, sl: 10 });
  const [isSavingQuota, setIsSavingQuota] = useState(false);
  const [orgDefaults, setOrgDefaults] = useState({ pl: 12, cl: 12, sl: 10 });

  // Dropdown menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Bulk import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Edit user modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<StaffUser | null>(null);

  // Fetch existing staff
  const fetchStaff = async () => {
    try {
      setIsLoading(true);
      setError('');
      const { data } = await api.get('/api/users/my-organization');

      // Define allowed roles for staff list
      const allowedRoles = ['SessionAdmin', 'Manager'];
      // SuperAdmin and CompanyAdmin can see Company Admins (stored as 'SuperAdmin' in backend)
      if (isPlatformOwner || isSuperAdmin || isCompanyAdmin) {
        allowedRoles.push('SuperAdmin'); // Backend role for Company Admin
        allowedRoles.push('CompanyAdmin'); // Legacy support
      }

      // Filter for staff roles
      const staff = data.filter((user: StaffUser) => allowedRoles.includes(user.role));
      setStaffList(staff);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('You are not authorized. Please log in again.');
      } else {
        setError('Could not fetch staff list. Please try again.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on component mount
  useEffect(() => {
    fetchStaff();
    // Fetch organization defaults for quota
    if (canManageQuota) {
      const fetchOrgDefaults = async () => {
        try {
          const { data } = await api.get('/api/organization/settings');
          setOrgDefaults({
            pl: data.yearlyQuotaPL || 12,
            cl: data.yearlyQuotaCL || 12,
            sl: data.yearlyQuotaSL || 10,
          });
        } catch (err) {
          console.error('Failed to fetch organization defaults:', err);
        }
      };
      fetchOrgDefaults();
    }
  }, [canManageQuota]);

  // Auto-dismiss success message
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
    setRole('SessionAdmin');
    setMessage('');
    setError('');
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    const staffData = {
      firstName,
      lastName,
      email,
      password,
      phone: phone || undefined,
      role,
    };

    try {
      const { data } = await api.post('/api/users/staff', staffData);

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

  // Handle quota management
  const handleOpenQuotaModal = async (staff: StaffUser) => {
    setSelectedStaffForQuota(staff);
    if (staff.customLeaveQuota) {
      setQuotaForm({
        pl: staff.customLeaveQuota.pl,
        cl: staff.customLeaveQuota.cl,
        sl: staff.customLeaveQuota.sl,
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
    setSelectedStaffForQuota(null);
    setQuotaForm({ pl: 12, cl: 12, sl: 10 });
  };

  const handleSaveQuota = async () => {
    if (!selectedStaffForQuota) return;

    try {
      setIsSavingQuota(true);
      const staffId = selectedStaffForQuota._id || selectedStaffForQuota.id;
      await api.put(`/api/users/${staffId}/quota`, quotaForm);

      setMessage(`Leave quota updated for ${selectedStaffForQuota.profile.firstName} ${selectedStaffForQuota.profile.lastName}`);
      handleCloseQuotaModal();
      fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to update quota');
    } finally {
      setIsSavingQuota(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!selectedStaffForQuota) return;

    try {
      setIsSavingQuota(true);
      const staffId = selectedStaffForQuota._id || selectedStaffForQuota.id;
      await api.put(`/api/users/${staffId}/quota`, { resetToDefault: true });

      setMessage(`Leave quota reset to default for ${selectedStaffForQuota.profile.firstName} ${selectedStaffForQuota.profile.lastName}`);
      handleCloseQuotaModal();
      fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to reset quota');
    } finally {
      setIsSavingQuota(false);
    }
  };

  // Handle device reset
  const handleResetDevice = async (staffId: string) => {
    if (!window.confirm('This will reset the device ID and send a new 6-digit password to the user\'s email. Continue?')) {
      return;
    }

    setResettingDevice(staffId);
    setError('');
    setMessage('');

    try {
      await api.put(`/api/users/${staffId}/reset-device`);

      setMessage('Staff device reset successfully. New credentials have been emailed.');
      await fetchStaff();
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

  // Handle device reset (Platform Owner only)
  const handleResetDeviceOnly = async (staffId: string) => {
    if (!window.confirm('Are you sure you want to reset this staff member\'s device ID? This will allow them to register a new device without changing their password.')) {
      return;
    }

    setResettingDevice(staffId);
    setError('');
    setMessage('');

    try {
      await api.put(`/api/users/${staffId}/reset-device-only`);

      setMessage('Device ID reset successfully! Staff member can now register a new device.');
      await fetchStaff();
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

  // Handle staff deletion
  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${staffName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingStaff(staffId);
    setError('');
    setMessage('');

    try {
      const { data } = await api.delete(`/api/users/${staffId}`);

      setMessage(data.msg || 'Staff member deleted successfully');
      await fetchStaff();
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You do not have permission to delete staff members.');
      } else {
        setError(err.response?.data?.msg || 'Failed to delete staff member. Please try again.');
      }
    } finally {
      setDeletingStaff(null);
    }
  };

  // Filter staff based on search term and role
  const filteredStaff = staffList.filter((staff) => {
    const staffName = `${staff.profile.firstName} ${staff.profile.lastName}`.toLowerCase();
    const staffEmail = staff.email.toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    // Search filter
    const matchesSearch = !searchTerm ||
      staffName.includes(searchLower) ||
      staffEmail.includes(searchLower);

    // Role filter
    const roleMap: { [key: string]: string } = {
      'All Roles': 'All',
      'Session Admin': 'SessionAdmin',
      'Manager': 'Manager',
      ...(isPlatformOwner || isSuperAdmin || isCompanyAdmin ? { 'Company Admin': 'SuperAdmin' } : {})
    };
    const mappedRole = roleMap[roleFilter] || roleFilter;
    const matchesRole = mappedRole === 'All' || staff.role === mappedRole || (mappedRole === 'SuperAdmin' && staff.role === 'CompanyAdmin');

    return matchesSearch && matchesRole;
  });

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

          {/* Messages */}
          {message && (
            <div className="mb-6 bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20 p-4 rounded-xl flex items-center shadow-sm">
              <span className="material-symbols-outlined mr-2">check_circle</span>
              {message}
            </div>
          )}

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
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="All Roles">All Roles</option>
                  <option value="Session Admin">Session Admin</option>
                  <option value="Manager">Manager</option>
                  {(isPlatformOwner || isSuperAdmin || isCompanyAdmin) && <option value="Company Admin">Company Admin</option>}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path clipRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" fillRule="evenodd"></path>
                  </svg>
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap hidden sm:block">
                Total: <span className="font-semibold text-gray-900 dark:text-white">{filteredStaff.length}</span>
              </div>
            </div>
          </div>

          <EntityTable
            data={filteredStaff}
            columns={[
              'Name',
              'Email',
              'Role',
              'Phone',
              ...((isSuperAdmin || canManageQuota) ? ['Actions'] : [])
            ]}
            isLoading={isLoading}
            emptyMessage="No staff members found."
            renderRow={(staff) => {
              const staffId = staff._id || staff.id || '';
              const roleDisplay = staff.role === 'SessionAdmin'
                ? 'Session Admin'
                : staff.role === 'SuperAdmin' || staff.role === 'CompanyAdmin'
                  ? 'Company Admin'
                  : staff.role;
              const isDeviceLocked = !!staff.registeredDeviceId;
              const isResetting = resettingDevice === staffId;
              const isDeleting = deletingStaff === staffId;
              const staffName = `${staff.profile.firstName} ${staff.profile.lastName}`;

              const currentUserId = user?.id;
              const isCurrentUser = staffId === currentUserId;
              const isSubordinate = ['Manager', 'SessionAdmin'].includes(staff.role);
              const canResetDevice = isPlatformOwner || isSuperAdmin || (isCompanyAdmin && (isCurrentUser || isSubordinate));
              const canDeleteStaff = isSuperAdmin && !isCurrentUser;

              return (
                <>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-3">
                      {staff.profileImageUrl || staff.profilePicture ? (
                        <img
                          src={getOptimizedImageUrl(staff.profileImageUrl || staff.profilePicture, 80, 80, 'fill')}
                          alt={staffName}
                          className="h-8 w-8 rounded-full object-cover bg-gray-100 dark:bg-gray-800"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 font-bold text-xs shrink-0">
                          {staff.profile.firstName?.[0]}{staff.profile.lastName?.[0]}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{staffName}</div>
                        {isDeviceLocked && (
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <span className="material-symbols-outlined text-[14px]">lock</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {staff.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {staff.role === 'SessionAdmin' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs leading-5 font-semibold rounded-full border bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>shield_person</span>
                        {roleDisplay}
                      </span>
                    ) : (staff.role === 'SuperAdmin' || staff.role === 'CompanyAdmin') ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs leading-5 font-semibold rounded-full border bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>admin_panel_settings</span>
                        {roleDisplay}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs leading-5 font-semibold rounded-full border bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>supervisor_account</span>
                        {roleDisplay}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {staff.profile.phone || 'N/A'}
                  </td>
                  {(isSuperAdmin || canManageQuota) && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      <div className="relative inline-block text-left" ref={(el) => { menuRefs.current[staffId] = el; }}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === staffId ? null : staffId)}
                          className="text-gray-400 hover:text-gray-500 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">more_vert</span>
                        </button>

                        {openMenuId === staffId && (
                          <div className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                            <div className="py-1">
                              {(isSuperAdmin || isCompanyAdmin) && (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setSelectedUserForEdit(staff);
                                    setIsEditModalOpen(true);
                                  }}
                                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <span className="material-symbols-outlined text-lg mr-3 text-gray-400 group-hover:text-gray-500">edit</span>
                                  Edit Profile
                                </button>
                              )}

                              {canManageQuota && (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleOpenQuotaModal(staff);
                                  }}
                                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <span className="material-symbols-outlined text-lg mr-3 text-gray-400 group-hover:text-gray-500">bar_chart</span>
                                  Manage Leave Quota
                                </button>
                              )}

                              {((isSuperAdmin && isDeviceLocked) || (isPlatformOwner && canResetDevice) || (isCompanyAdmin && canResetDevice)) && (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    if (isPlatformOwner) {
                                      handleResetDeviceOnly(staffId);
                                    } else {
                                      handleResetDevice(staffId);
                                    }
                                  }}
                                  disabled={isResetting}
                                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {isResetting ? (
                                    <span className="animate-spin h-4 w-4 mr-3 border-2 border-gray-400 border-t-transparent rounded-full"></span>
                                  ) : (
                                    <span className="material-symbols-outlined text-lg mr-3 text-amber-500">restart_alt</span>
                                  )}
                                  Reset Device ID
                                </button>
                              )}
                            </div>

                            {canDeleteStaff && (
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleDeleteStaff(staffId, staffName);
                                  }}
                                  disabled={isDeleting || ((staff.role === 'SuperAdmin' || staff.role === 'CompanyAdmin') && isCurrentUser)}
                                  className="group flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                                  title={((staff.role === 'SuperAdmin' || staff.role === 'CompanyAdmin') && isCurrentUser) ? 'You cannot delete yourself' : ''}
                                >
                                  {isDeleting ? (
                                    <span className="animate-spin h-4 w-4 mr-3 border-2 border-red-500 border-t-transparent rounded-full"></span>
                                  ) : (
                                    <span className="material-symbols-outlined text-lg mr-3">delete</span>
                                  )}
                                  Delete Staff
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                </>
              );
            }}
          />

          {/* Create Staff Modal */}
          <EntityFormModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Create New Staff Member"
          >
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                  <input
                    className="block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                    placeholder="e.g. Suresh"
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
                    placeholder="e.g. Patil"
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
                  placeholder="e.g. suresh.patil@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  className="block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'SessionAdmin' | 'Manager')}
                  required
                  disabled={isSubmitting}
                >
                  <option value="SessionAdmin">Session Admin</option>
                  <option value="Manager">Manager</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">Can manage assigned classes/batches.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number (Optional)</label>
                <input
                  className="block w-full rounded-lg border-0 py-2.5 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  placeholder="e.g. +91 98765 12345"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
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
                  {isSubmitting ? 'Creating...' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </EntityFormModal>

          {/* Quota Management Modal */}
          {quotaModalOpen && selectedStaffForQuota && (
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
                    Setting custom leave quotas for <strong>{selectedStaffForQuota.profile.firstName} {selectedStaffForQuota.profile.lastName}</strong>
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

                    {selectedStaffForQuota.customLeaveQuota && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                          This staff member currently has custom quotas. Organization default: PL: {orgDefaults.pl}, CL: {orgDefaults.cl}, SL: {orgDefaults.sl}
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

          {/* Bulk Import Staff Modal */}
          <BulkImportStaff
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onSuccess={fetchStaff}
          />

          {/* Edit User Modal */}
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

        </div>
      </div>
    </div>
  );
};

export default ManageStaff;
