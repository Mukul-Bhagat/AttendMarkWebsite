import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface AuditLog {
  id: string;
  time: string;
  action: 'FORCE_ATTENDANCE_CORRECTION' | 'DEVICE_RESET' | 'UPDATE_ORGANIZATION_STATUS' | 'CANCEL_SESSION' | 'CREATE_USER' | 'DELETE_USER' | 'CREATE_STAFF' | 'BULK_IMPORT_STAFF' | 'DELETE_STAFF' | 'OTHER';
  performedBy: {
    name: string;
    email: string;
    role: string;
  };
  targetUser: {
    name: string;
    email: string;
  } | null;
  organizationPrefix: string;
  organizationName: string | null;
  details: any;
  detailsSummary: string;
}

const PlatformAuditLogs: React.FC = () => {
  const { isPlatformOwner } = useAuth();
  const navigate = useNavigate();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState<string>('all');

  useEffect(() => {
    // Redirect if not Platform Owner
    if (!isPlatformOwner) {
      navigate('/dashboard');
      return;
    }

    const fetchAuditLogs = async () => {
      try {
        setIsLoading(true);
        setError('');
        const { data } = await api.get('/api/platform/audit-logs');
        const logs = data.auditLogs || [];
        setAuditLogs(logs);
        setFilteredLogs(logs);
      } catch (err: any) {
        console.error('Failed to fetch audit logs:', err);
        setError(err.response?.data?.msg || 'Failed to load audit logs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuditLogs();
  }, [isPlatformOwner, navigate]);

  // Get unique organization names for filter
  const uniqueOrganizations = React.useMemo(() => {
    const orgs = new Set<string>();
    auditLogs.forEach(log => {
      if (log.organizationName) {
        orgs.add(log.organizationName);
      }
    });
    return Array.from(orgs).sort();
  }, [auditLogs]);

  // Filter logs based on selected organization
  React.useEffect(() => {
    if (selectedOrganization === 'all') {
      setFilteredLogs(auditLogs);
    } else {
      setFilteredLogs(auditLogs.filter(log => log.organizationName === selectedOrganization));
    }
  }, [selectedOrganization, auditLogs]);

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day} ${month} ${year}, ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'FORCE_ATTENDANCE_CORRECTION':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'DEVICE_RESET':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'UPDATE_ORGANIZATION_STATUS':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'CANCEL_SESSION':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
      case 'CREATE_USER':
      case 'CREATE_STAFF':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'DELETE_USER':
      case 'DELETE_STAFF':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'BULK_IMPORT_STAFF':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatActionName = (action: string) => {
    switch (action) {
      case 'FORCE_ATTENDANCE_CORRECTION':
        return 'FORCE_MARK';
      case 'DEVICE_RESET':
        return 'RESET_DEVICE';
      case 'UPDATE_ORGANIZATION_STATUS':
        return 'SUSPEND_ORG';
      case 'CANCEL_SESSION':
        return 'CANCEL_SESSION';
      case 'CREATE_USER':
        return 'CREATE_USER';
      case 'CREATE_STAFF':
        return 'CREATE_STAFF';
      case 'DELETE_USER':
        return 'DELETE_USER';
      case 'DELETE_STAFF':
        return 'DELETE_STAFF';
      case 'BULK_IMPORT_STAFF':
        return 'BULK_IMPORT';
      default:
        return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
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
          <header className="flex flex-wrap items-center justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl md:text-4xl">history</span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">
                Audit Logs
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Organization Filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="org-filter" className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                  Filter by Organization:
                </label>
                <select
                  id="org-filter"
                  value={selectedOrganization}
                  onChange={(e) => setSelectedOrganization(e.target.value)}
                  className="form-select appearance-none rounded-lg text-sm text-text-primary-light dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-border-light dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-primary/50 dark:focus:border-primary/50 h-10 px-3 min-w-[180px]"
                >
                  <option value="all">All Organizations</option>
                  {uniqueOrganizations.map((orgName) => (
                    <option key={orgName} value={orgName}>
                      {orgName}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {filteredLogs.length} Log{filteredLogs.length !== 1 ? 's' : ''}
              </span>
            </div>
          </header>

          {filteredLogs.length === 0 ? (
            <div className="mt-8 sm:mt-12">
              <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-8 text-center">
                <span className="material-symbols-outlined text-6xl text-text-secondary-light dark:text-text-secondary-dark mb-4">
                  history
                </span>
                <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                  No Audit Logs Found
                </h2>
                <p className="text-text-secondary-light dark:text-text-secondary-dark">
                  No audit logs have been recorded yet.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" scope="col">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" scope="col">
                        Action Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" scope="col">
                        Organization
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" scope="col">
                        Admin Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" scope="col">
                        Target User / Org
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider" scope="col">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-border-light dark:divide-border-dark">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary-light dark:text-text-primary-dark">
                          {formatTime(log.time)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                            {formatActionName(log.action)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary-light dark:text-text-primary-dark">
                          <div className="font-medium">
                            {log.organizationName || (log.organizationPrefix ? 'System' : 'Global')}
                          </div>
                          {log.organizationPrefix && (
                            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                              {log.organizationPrefix}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary-light dark:text-text-primary-dark">
                          <div>
                            <div className="font-medium">{log.performedBy.name}</div>
                            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{log.performedBy.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary-light dark:text-text-primary-dark">
                          {log.targetUser ? (
                            <div>
                              <div className="font-medium">{log.targetUser.name}</div>
                              <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{log.targetUser.email}</div>
                            </div>
                          ) : log.action === 'UPDATE_ORGANIZATION_STATUS' && log.details?.organizationName ? (
                            <div>
                              <div className="font-medium">{log.details.organizationName}</div>
                              <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Organization</div>
                            </div>
                          ) : (
                            <span className="text-text-secondary-light dark:text-text-secondary-dark">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-text-primary-light dark:text-text-primary-dark">
                          <div className="max-w-md">
                            <div className="font-medium">{log.detailsSummary}</div>
                            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                              Org: {log.organizationPrefix}
                            </div>
                            {log.action === 'UPDATE_ORGANIZATION_STATUS' && log.details?.oldStatus && (
                              <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                                Status: {log.details.oldStatus} → {log.details.newStatus}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PlatformAuditLogs;

