import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatIST } from '../utils/time';

import { appLogger } from '../shared/logger';

type AuditLogEntry = {
  id: string;
  organizationId?: string;
  actorUserId?: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  description?: string;
  metadata?: Record<string, any> | null;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  createdAtIST?: string;
};

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type OrganizationOption = {
  id: string;
  name: string;
  collectionPrefix?: string;
};

type AuditLogsPageProps = {
  scope: 'platform' | 'admin';
};

const DEFAULT_LIMIT = 20;

const formatDate = (value?: string): string => {
  if (!value) return '--';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '--';
  return formatIST(timestamp, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const formatTime = (value?: string): string => {
  if (!value) return '--';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '--';
  return formatIST(timestamp, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatLabel = (value?: string): string => {
  if (!value) return '';
  return value.replace(/_/g, ' ');
};

const AuditLogsPage: React.FC<AuditLogsPageProps> = ({ scope }) => {
  const { isPlatformOwner } = useAuth();
  const isPlatformView = scope === 'platform';
  const viewLabel = isPlatformOwner
    ? 'Platform-wide visibility across organizations.'
    : isPlatformView
      ? 'Platform audit visibility.'
      : 'Organization-scoped audit history.';

  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('all');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionType, setActionType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    if (!isPlatformOwner) return;

    const fetchOrganizations = async () => {
      try {
        const { data } = await api.get('/api/platform/organizations');
        const orgs = Array.isArray(data?.organizations) ? data.organizations : [];
        setOrganizations(
          orgs.map((org: any) => ({
            id: org.id || org._id,
            name: org.name,
            collectionPrefix: org.collectionPrefix,
          }))
        );
      } catch (err) {
        appLogger.error('Failed to fetch organizations for audit logs:', err);
      }
    };

    fetchOrganizations();
  }, [isPlatformOwner]);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [startDate, endDate, actionType, entityType, selectedOrganizationId, limit]);

  useEffect(() => {
    let isActive = true;

    const fetchAuditLogs = async () => {
      try {
        setIsLoading(true);
        setError('');

        const params: Record<string, any> = {
          page,
          limit,
        };

        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        if (actionType.trim()) params.actionType = actionType.trim();
        if (entityType.trim()) params.entityType = entityType.trim();
        if (isPlatformOwner && selectedOrganizationId !== 'all') {
          params.organizationId = selectedOrganizationId;
        }

        const { data } = await api.get('/api/audit-logs', { params });
        if (!isActive) return;

        setAuditLogs(Array.isArray(data?.auditLogs) ? data.auditLogs : []);
        setPagination({
          page: data?.pagination?.page ?? page,
          limit: data?.pagination?.limit ?? limit,
          total: data?.pagination?.total ?? 0,
          totalPages: data?.pagination?.totalPages ?? 1,
        });
      } catch (err: any) {
        if (!isActive) return;
        appLogger.error('Failed to fetch audit logs:', err);
        setError(err.response?.data?.msg || 'Failed to load audit logs');
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    fetchAuditLogs();

    return () => {
      isActive = false;
    };
  }, [page, limit, startDate, endDate, actionType, entityType, selectedOrganizationId, isPlatformOwner]);

  const totalLabel = useMemo(() => {
    const total = pagination.total;
    return `${total} Log${total === 1 ? '' : 's'}`;
  }, [pagination.total]);

  const diffData = useMemo(() => {
    if (!selectedLog?.metadata) return { changedFields: [], overrides: null };
    const diff = (selectedLog.metadata as any).diff || {};
    const changedFields = Array.isArray(diff.changedFields) ? diff.changedFields : [];
    const overrides = diff.overrides || null;
    return { changedFields, overrides };
  }, [selectedLog]);

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setActionType('');
    setEntityType('');
    if (isPlatformOwner) {
      setSelectedOrganizationId('all');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
          <p className="text-xl text-gray-700 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl md:text-4xl">history</span>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">
                  Audit Logs
                </h1>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {viewLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {totalLabel}
              </span>
            </div>
          </header>

          <section className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-4 sm:p-5 mb-4 sm:mb-6">
            <div className="flex flex-wrap items-end gap-3">
              {isPlatformOwner && (
                <div className="flex flex-col gap-1 min-w-[200px]">
                  <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                    Organization
                  </label>
                  <select
                    value={selectedOrganizationId}
                    onChange={(e) => setSelectedOrganizationId(e.target.value)}
                    className="form-select appearance-none rounded-lg text-sm text-text-primary-light dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-border-light dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-primary/50 dark:focus:border-primary/50 h-10 px-3"
                  >
                    <option value="all">All Organizations</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                  Start Date (IST)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border-light dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-text-primary-light dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                  End Date (IST)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border-light dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-text-primary-light dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-[180px]">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                  Action Type
                </label>
                <input
                  type="text"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  placeholder="e.g. SESSION_EDITED"
                  className="h-10 px-3 rounded-lg border border-border-light dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-text-primary-light dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-[160px]">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                  Entity Type
                </label>
                <input
                  type="text"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  placeholder="e.g. Session"
                  className="h-10 px-3 rounded-lg border border-border-light dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-text-primary-light dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={resetFilters}
                className="h-10 px-4 rounded-lg border border-border-light dark:border-slate-600 text-sm font-semibold text-text-primary-light dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Clear
              </button>
            </div>
          </section>

          {auditLogs.length === 0 ? (
            <div className="mt-6">
              <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-8 text-center">
                <span className="material-symbols-outlined text-6xl text-text-secondary-light dark:text-text-secondary-dark mb-4">
                  history
                </span>
                <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                  No Audit Logs Found
                </h2>
                <p className="text-text-secondary-light dark:text-text-secondary-dark">
                  Try adjusting the filters or date range.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date (IST)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time (IST)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actor Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Entity Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-border-light dark:divide-border-dark">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="px-4 py-4 text-sm text-text-primary-light dark:text-text-primary-dark whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary-light dark:text-text-primary-dark whitespace-nowrap">
                          {formatTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary-light dark:text-text-primary-dark">
                          <div className="font-medium">{log.actorName}</div>
                          <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{log.actorEmail}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary-light dark:text-text-primary-dark whitespace-nowrap">
                          {formatLabel(log.actorRole)}
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary-light dark:text-text-primary-dark whitespace-nowrap">
                          {formatLabel(log.actionType)}
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary-light dark:text-text-primary-dark whitespace-nowrap">
                          {formatLabel(log.entityType)}
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary-light dark:text-text-primary-dark">
                          <div className="line-clamp-2">{log.description || '--'}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-text-primary-light dark:text-text-primary-dark whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-primary font-semibold hover:underline"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-900/30">
                <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  <span>Rows per page</span>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="h-9 px-2 rounded-md border border-border-light dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                  >
                    {[20, 50, 100, 200].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  <span>
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 rounded-md border border-border-light dark:border-slate-600 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 rounded-md border border-border-light dark:border-slate-600 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary-light dark:text-white">Audit Details</h3>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {formatLabel(selectedLog.actionType)} - {formatLabel(selectedLog.entityType)}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">Actor</p>
                  <p className="text-sm font-semibold text-text-primary-light dark:text-white">{selectedLog.actorName}</p>
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{selectedLog.actorEmail}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">Actor Role</p>
                  <p className="text-sm font-semibold text-text-primary-light dark:text-white">{formatLabel(selectedLog.actorRole)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">IP Address</p>
                  <p className="text-sm text-text-primary-light dark:text-white">{selectedLog.ipAddress || '--'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">User Agent</p>
                  <p className="text-sm text-text-primary-light dark:text-white break-all">{selectedLog.userAgent || '--'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">Changed Fields</p>
                {diffData.changedFields.length === 0 ? (
                  <p className="text-sm text-text-primary-light dark:text-white">None</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {diffData.changedFields.map((field) => (
                      <span
                        key={field}
                        className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark mb-2">Before</p>
                  <pre className="text-xs bg-gray-50 dark:bg-slate-800 rounded-lg p-3 overflow-auto max-h-64">
                    {selectedLog.before ? JSON.stringify(selectedLog.before, null, 2) : 'None'}
                  </pre>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark mb-2">After</p>
                  <pre className="text-xs bg-gray-50 dark:bg-slate-800 rounded-lg p-3 overflow-auto max-h-64">
                    {selectedLog.after ? JSON.stringify(selectedLog.after, null, 2) : 'None'}
                  </pre>
                </div>
              </div>

              {diffData.overrides && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark mb-2">Overrides</p>
                  <pre className="text-xs bg-gray-50 dark:bg-slate-800 rounded-lg p-3 overflow-auto max-h-64">
                    {JSON.stringify(diffData.overrides, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border-light dark:border-border-dark flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
