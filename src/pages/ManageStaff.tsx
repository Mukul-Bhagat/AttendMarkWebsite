import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import BulkImportStaff from '../components/BulkImportStaff';

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

  // Fetch existing staff
  const fetchStaff = async () => {
    try {
      setIsLoading(true);
      setError(''); // Clear any previous errors
      const { data } = await api.get('/api/users/my-organization');
      
      // Define allowed roles for staff list
      const allowedRoles = ['SessionAdmin', 'Manager'];
      // Platform Owner can also see Company Admins
      if (isPlatformOwner) {
        allowedRoles.push('CompanyAdmin');
      }
      
      // Filter for staff roles (Manager, SessionAdmin, and CompanyAdmin for Platform Owner)
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
          // Use defaults if fetch fails
          console.error('Failed to fetch organization defaults:', err);
        }
      };
      fetchOrgDefaults();
    }
  }, [canManageQuota]);

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
      // Use the API endpoint from Step 11
      const { data } = await api.post('/api/users/staff', staffData);
      
      setMessage(data.msg || `${role} created successfully`);
      clearForm();
      // Refresh the list immediately
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
    // Pre-fill with current custom quota or org defaults
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
      fetchStaff(); // Refresh staff list
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
      fetchStaff(); // Refresh staff list
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to reset quota');
    } finally {
      setIsSavingQuota(false);
    }
  };

  // Handle device reset (SuperAdmin only)
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
      // Refresh the list to show updated device status
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

  // Handle device reset (Platform Owner only - without password reset)
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
      // Refresh the list to show updated device status
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

  // Handle staff deletion (SuperAdmin only)
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
      // Refresh the list
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
    
    // Search filter: check if name or email includes search term
    const matchesSearch = !searchTerm || 
      staffName.includes(searchLower) || 
      staffEmail.includes(searchLower);
    
    // Role filter: check if role matches
    // Map dropdown values to actual role values
    const roleMap: { [key: string]: string } = {
      'All Roles': 'All',
      'Session Admin': 'SessionAdmin',
      'Manager': 'Manager',
      ...(isPlatformOwner ? { 'Company Admin': 'CompanyAdmin' } : {})
    };
    const mappedRole = roleMap[roleFilter] || roleFilter;
    const matchesRole = mappedRole === 'All' || staff.role === mappedRole;
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl mx-auto">
          <div className="flex flex-wrap justify-between gap-3 p-4">
            <p className="text-[#181511] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">Manage Staff</p>
          </div>

          {/* Success Message */}
          {message && (
            <div className="px-4 py-3">
              <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 p-4 rounded-xl flex items-center">
                <span className="material-symbols-outlined mr-2">check_circle</span>
                {message}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="px-4 py-3">
              <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center">
                <span className="material-symbols-outlined mr-2">cancel</span>
                {error}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center">
                <svg className="animate-spin h-8 w-8 text-[#f04129] mb-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                </svg>
                <p className="text-[#8a7b60] dark:text-gray-400">Loading staff list...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4">
              {/* Create Staff Form */}
              <div className="lg:col-span-1 bg-white dark:bg-slate-800 dark:border dark:border-slate-700 rounded-xl shadow-sm p-6 sm:p-8 lg:sticky lg:top-8 lg:self-start">
                <div className="flex items-center justify-between pb-5">
                  <h2 className="text-[#181511] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] flex items-center">
                    <span className="material-symbols-outlined mr-3 text-[#f04129]" style={{ fontSize: '28px' }}>manage_accounts</span>
                    Add Staff Member
                  </h2>
                  {(isSuperAdmin || isCompanyAdmin || isPlatformOwner) && (
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-[#f04129] rounded-lg hover:from-orange-600 hover:to-[#d63a25] transition-all duration-200 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-lg">upload_file</span>
                      Import CSV
                    </button>
                  )}
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col min-w-40 flex-1 mb-4">
                      <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">First Name</p>
                      <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-14 placeholder:text-[#8a7b60] dark:placeholder-gray-400 p-[15px] text-base font-normal leading-normal"
                        placeholder="Suresh"
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
                    <label className="flex flex-col min-w-40 flex-1 mb-4">
                      <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">Last Name</p>
                      <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-14 placeholder:text-[#8a7b60] dark:placeholder-gray-400 p-[15px] text-base font-normal leading-normal"
                        placeholder="Patil"
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

                  <label className="flex flex-col w-full mb-4">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">Email</p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-14 placeholder:text-[#8a7b60] dark:placeholder-gray-400 p-[15px] text-base font-normal leading-normal"
                      placeholder="suresh.patil@example.com"
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

                  <label className="flex flex-col w-full mb-4">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">Password</p>
                    <div className="relative">
                      <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-14 placeholder:text-[#8a7b60] dark:placeholder-gray-400 p-[15px] pr-12 text-base font-normal leading-normal"
                        placeholder="Enter password"
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
                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#8a7b60] dark:text-gray-400 hover:text-[#f04129] z-10 cursor-pointer"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Min 6 chars</p>
                  </label>

                  <label className="flex flex-col w-full mb-4">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">Phone (Optional)</p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-14 placeholder:text-[#8a7b60] dark:placeholder-gray-400 p-[15px] text-base font-normal leading-normal"
                      placeholder="+91 98765 12345"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </label>

                  <div className="flex flex-col w-full mb-4">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">Role</p>
                    <div className="relative">
                      <select
                        className="form-select flex w-full appearance-none min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-14 p-[15px] text-base font-normal leading-normal"
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'SessionAdmin' | 'Manager')}
                        required
                        disabled={isSubmitting}
                      >
                        <option value="SessionAdmin">Session Admin</option>
                        <option value="Manager">Manager</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Can manage assigned classes/batches.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f04129] px-6 py-4 text-base font-semibold leading-6 text-white shadow-sm hover:bg-[#d63a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined">person_add</span>
                    {isSubmitting ? 'Creating...' : 'Create Staff Member'}
                  </button>
                  <button
                    type="button"
                    onClick={clearForm}
                    disabled={isSubmitting}
                    className="w-full text-center text-gray-500 dark:text-gray-400 mt-2 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 text-sm font-medium py-2 disabled:opacity-50"
                  >
                    Clear Form
                  </button>
                </form>
              </div>

              {/* Staff Table */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 dark:border dark:border-slate-700 rounded-xl shadow-sm p-6 sm:p-8">
                <div className="flex items-center justify-between pb-5">
                  <h2 className="text-[#181511] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] flex items-center">
                    Current Staff
                    <span className="ml-3 px-3 py-1 bg-red-100 text-[#f04129] dark:bg-[#f04129]/20 dark:text-[#f04129] rounded-full text-sm font-semibold">
                      {staffList.length}
                    </span>
                  </h2>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-5">
                  <div className="relative flex-grow">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input
                      className="form-input w-full rounded-lg text-sm text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-12 placeholder:text-[#8a7b60] dark:placeholder-gray-400 pl-10 pr-4"
                      placeholder="Search by name or email..."
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="relative min-w-[180px]">
                    <select 
                      className="form-select w-full appearance-none rounded-lg text-sm text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-[#f04129] border border-[#e6e2db] dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-primary/50 dark:focus:border-primary/50 h-12 px-4"
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                    >
                      <option value="All Roles">All Roles</option>
                      <option value="Session Admin">Session Admin</option>
                      <option value="Manager">Manager</option>
                      {isPlatformOwner && <option value="Company Admin">Company Admin</option>}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">expand_more</span>
                  </div>
                </div>

                {staffList.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[#8a7b60] dark:text-gray-400 text-base mb-2">No staff members found.</p>
                    <p className="text-[#8a7b60] dark:text-gray-400 text-sm">Create your first staff member using the form above.</p>
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[#8a7b60] dark:text-gray-400 text-base mb-2">No matching records found.</p>
                    <p className="text-[#8a7b60] dark:text-gray-400 text-sm">Try adjusting your search or filter criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-white/5">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" scope="col">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" scope="col">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" scope="col">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" scope="col">Phone</th>
                          {(isSuperAdmin || canManageQuota) && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-16" scope="col">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredStaff.map((staff) => {
                          const staffId = staff._id || staff.id || '';
                          const roleDisplay = staff.role === 'SessionAdmin' 
                            ? 'Session Admin' 
                            : staff.role === 'CompanyAdmin' 
                            ? 'Company Admin' 
                            : staff.role;
                          const isDeviceLocked = !!staff.registeredDeviceId;
                          const isResetting = resettingDevice === staffId;
                          const isDeleting = deletingStaff === staffId;
                          const staffName = `${staff.profile.firstName} ${staff.profile.lastName}`;
                          
                          // Determine if current user can reset this staff member's device
                          // Platform Owner can reset ANYONE, including Company Admin
                          // Company Admin can reset themselves OR subordinates (Manager, SessionAdmin)
                          // Company Admin cannot reset another Company Admin
                          const currentUserId = user?.id || user?._id;
                          const isCurrentUser = staffId === currentUserId;
                          const isSubordinate = ['Manager', 'SessionAdmin'].includes(staff.role);
                          const canResetDevice = isPlatformOwner || isSuperAdmin || (isCompanyAdmin && (isCurrentUser || isSubordinate));
                          
                          // Determine if current user can delete this staff member
                          // SuperAdmin can delete, but not themselves
                          const canDeleteStaff = isSuperAdmin && !isCurrentUser;
                          
                          return (
                            <tr key={staffId} className="hover:bg-red-50 dark:hover:bg-[#f04129]/10 transition-colors duration-150">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                <div className="flex items-center gap-2">
                                  <span>{staffName}</span>
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {staff.email}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {staff.role === 'SessionAdmin' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs leading-5 font-semibold rounded-full border bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800">
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>shield_person</span>
                                    {roleDisplay}
                                  </span>
                                ) : staff.role === 'CompanyAdmin' ? (
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium w-16">
                                  <div className="relative" ref={(el) => { menuRefs.current[staffId] = el; }}>
                                    <button
                                      onClick={() => setOpenMenuId(openMenuId === staffId ? null : staffId)}
                                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 p-2 rounded-full transition-colors"
                                      title="Settings"
                                    >
                                      <span className="material-symbols-outlined text-xl">more_vert</span>
                                    </button>
                                    
                                    {openMenuId === staffId && (
                                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50">
                                        <ul className="py-1">
                                          {/* 1. Manage Leave Quota */}
                                          {canManageQuota && (
                                            <li>
                                              <button
                                                onClick={() => {
                                                  setOpenMenuId(null);
                                                  handleOpenQuotaModal(staff);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                              >
                                                <span className="material-symbols-outlined text-lg">bar_chart</span>
                                                <span>Manage Leave Quota</span>
                                              </button>
                                            </li>
                                          )}
                                          
                                          {/* 2. Reset Device ID: Show for:
                                              - SuperAdmin (when device is locked)
                                              - Platform Owner (can reset anyone)
                                              - Company Admin (can reset themselves or subordinates) */}
                                          {((isSuperAdmin && isDeviceLocked) || (isPlatformOwner && canResetDevice) || (isCompanyAdmin && canResetDevice)) && (
                                            <li>
                                              <button
                                                onClick={() => {
                                                  setOpenMenuId(null);
                                                  handleResetDevice(staffId);
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
                                          
                                          {/* 3. Delete Staff: Only show for SuperAdmin, and hide if trying to delete themselves */}
                                          {canDeleteStaff && (
                                            <li>
                                              <button
                                                onClick={() => {
                                                  setOpenMenuId(null);
                                                  handleDeleteStaff(staffId, staffName);
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
                                                    <span>Delete Staff</span>
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
          )}
        </div>
      </div>

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
    </div>
  );
};

export default ManageStaff;

