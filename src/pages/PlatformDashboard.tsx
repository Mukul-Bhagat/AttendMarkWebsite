import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatIST } from '../utils/time';
import CreateOrganizationModal from '../components/CreateOrganizationModal';
import Toast from '../components/Toast';

import { appLogger } from '../shared/logger';
interface Organization {
  id: string;
  name: string;
  collectionPrefix: string;
  adminName: string;
  totalUsers: number;
  subscriptionStatus: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

const PlatformDashboard: React.FC = () => {
  const { switchOrganization, isPlatformOwner } = useAuth();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<{ [key: string]: boolean }>({});

  // New state for modal and toast
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      setError('');
      const { data } = await api.get('/api/platform/organizations');
      setOrganizations(data.organizations || []);
    } catch (err: any) {
      appLogger.error('Failed to fetch organizations:', err);
      setError(err.response?.data?.msg || 'Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Redirect if not Platform Owner
    if (!isPlatformOwner) {
      navigate('/dashboard');
      return;
    }

    fetchOrganizations();
  }, [isPlatformOwner, navigate]);

  // Filter organizations based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredOrganizations(organizations);
    } else {
      const filtered = organizations.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredOrganizations(filtered);
    }
  }, [searchQuery, organizations]);

  const handleOrganizationClick = async (org: Organization) => {
    try {
      // Switch to the selected organization
      await switchOrganization(org.id);
      // Navigation will happen automatically via switchOrganization
    } catch (err: any) {
      appLogger.error('Failed to switch organization:', err);
      alert(err.response?.data?.msg || 'Failed to switch organization');
    }
  };

  const handleStatusToggle = async (e: React.MouseEvent, org: Organization) => {
    e.stopPropagation(); // Prevent card click when toggling status

    const newStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMessage = newStatus === 'SUSPENDED'
      ? `Are you sure you want to SUSPEND "${org.name}"? All users will be blocked from accessing this organization.`
      : `Are you sure you want to ACTIVATE "${org.name}"? Users will be able to access this organization again.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setUpdatingStatus({ ...updatingStatus, [org.id]: true });
    setError('');

    try {
      await api.patch(`/api/platform/organizations/${org.id}/status`, { status: newStatus });

      // Update the organization in the list
      setOrganizations(organizations.map(o =>
        o.id === org.id ? { ...o, status: newStatus } : o
      ));

      setToast({
        message: `Organization ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'} successfully`,
        type: 'success'
      });
    } catch (err: any) {
      appLogger.error('Failed to update organization status:', err);
      const errorMsg = err.response?.data?.msg || 'Failed to update organization status';
      setError(errorMsg);
      setToast({
        message: errorMsg,
        type: 'error'
      });
    } finally {
      setUpdatingStatus({ ...updatingStatus, [org.id]: false });
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    setToast({
      message: 'Organization created successfully! Welcome email sent to admin.',
      type: 'success'
    });
    fetchOrganizations(); // Refresh list
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatIST(date.getTime(), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (isLoading && !organizations.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // We don't block the UI with full-screen error if there are organizations loaded (just show toast or banner)
  // But if initial load failed, we show error screen.
  if (error && !organizations.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
          <p className="text-xl text-gray-700 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8">
          <header className="flex flex-col gap-4 mb-4 sm:mb-6 md:mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl md:text-4xl">dashboard</span>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">
                  Platform Dashboard
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="hidden sm:inline-block text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {filteredOrganizations.length} of {organizations.length} Organization{organizations.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 bg-primary hover:bg-[#d63a25] text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined">add_business</span>
                  <span className="hidden sm:inline">New Organization</span>
                  <span className="sm:hidden">New</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative w-full max-w-2xl">
              <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark text-xl">
                search
              </span>
              <input
                type="text"
                placeholder="Search Organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark placeholder:text-text-secondary-light dark:placeholder:text-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              )}
            </div>
          </header>

          {filteredOrganizations.length === 0 && organizations.length > 0 ? (
            <div className="mt-8 sm:mt-12">
              <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-8 text-center">
                <span className="material-symbols-outlined text-6xl text-text-secondary-light dark:text-text-secondary-dark mb-4">
                  search_off
                </span>
                <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                  No Organizations Found
                </h2>
                <p className="text-text-secondary-light dark:text-text-secondary-dark">
                  No organizations match your search query "{searchQuery}".
                </p>
              </div>
            </div>
          ) : organizations.length === 0 && !isLoading ? (
            <div className="mt-8 sm:mt-12">
              <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-8 text-center">
                <span className="material-symbols-outlined text-6xl text-text-secondary-light dark:text-text-secondary-dark mb-4">
                  business
                </span>
                <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                  No Organizations Found
                </h2>
                <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6">
                  There are no organizations registered in the platform yet.
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 bg-primary hover:bg-[#d63a25] text-white px-6 py-3 rounded-lg font-bold transition-colors mx-auto"
                >
                  <span className="material-symbols-outlined">add_business</span>
                  Create First Organization
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {filteredOrganizations.map((org) => {
                const isSuspended = org.status === 'SUSPENDED';
                const isUpdating = updatingStatus[org.id];

                return (
                  <div
                    key={org.id}
                    onClick={() => handleOrganizationClick(org)}
                    className={`bg-surface-light dark:bg-surface-dark rounded-lg border p-6 cursor-pointer transition-all duration-200 group ${isSuspended
                      ? 'border-red-500 dark:border-red-600 opacity-75 hover:opacity-90'
                      : 'border-border-light dark:border-border-dark hover:shadow-lg hover:border-primary'
                      }`}
                  >
                    {/* Organization Name and Status Toggle */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <h3 className={`text-2xl font-bold group-hover:text-primary transition-colors ${isSuspended
                          ? 'text-gray-500 dark:text-gray-400'
                          : 'text-text-primary-light dark:text-text-primary-dark'
                          }`}>
                          {org.name}
                        </h3>
                        {isSuspended && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 mt-1">
                            SUSPENDED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Status Toggle Switch */}
                        <button
                          onClick={(e) => handleStatusToggle(e, org)}
                          disabled={isUpdating}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isSuspended ? 'bg-red-600' : 'bg-green-600'
                            }`}
                          title={isSuspended ? 'Click to activate' : 'Click to suspend'}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSuspended ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                        <span className="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark group-hover:text-primary transition-colors">
                          arrow_forward
                        </span>
                      </div>
                    </div>

                    {/* Admin Name */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1">
                        <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                        <span>Admin</span>
                      </div>
                      <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark ml-6">
                        {org.adminName}
                      </p>
                    </div>

                    {/* Total Users */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1">
                        <span className="material-symbols-outlined text-base">people</span>
                        <span>Total Users</span>
                      </div>
                      <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark ml-6">
                        {org.totalUsers}
                      </p>
                    </div>

                    {/* Organization Status */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1">
                        <span className="material-symbols-outlined text-base">verified</span>
                        <span>Organization Status</span>
                      </div>
                      <div className="ml-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${org.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                        >
                          {org.status}
                        </span>
                      </div>
                    </div>

                    {/* Subscription Status */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark mb-1">
                        <span className="material-symbols-outlined text-base">subscriptions</span>
                        <span>Subscription</span>
                      </div>
                      <div className="ml-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${org.subscriptionStatus === 'Active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                        >
                          {org.subscriptionStatus}
                        </span>
                      </div>
                    </div>

                    {/* Created Date */}
                    <div className="pt-3 border-t border-border-light dark:border-border-dark">
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        Created: {formatDate(org.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <CreateOrganizationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default PlatformDashboard;

