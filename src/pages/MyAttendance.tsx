import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart3, CircleAlert, Table as TableIcon } from 'lucide-react';
import { nowIST, toISTDateString } from '../utils/time';
import { getMyAttendanceAttempts, getMyDashboard, getMySessions } from '../api/analyticsApi';
import AnalyticsFilters from '../components/attendance/AnalyticsFilters';
import AnalyticsTab from '../components/attendance/AnalyticsTab';
import AttendanceReportTab from '../components/attendance/reporting/AttendanceReportTab';
import DownloadReportModal from '../components/attendance/reporting/DownloadReportModal';
import ShareReportModal from '../components/attendance/reporting/ShareReportModal';
import { useAuth } from '../contexts/AuthContext';
import ReportApprovalPanel from '../components/attendance/reporting/ReportApprovalPanel';
import { AutomationIndicator } from '../components/attendance/reporting/AutomationIndicator';
import { getEmailAutomationConfigs, toggleEmailAutomation, deleteEmailAutomation } from '../api/reportingApi';
import toast from 'react-hot-toast';
import AttendanceIssuePanel from '../components/attendance/AttendanceIssuePanel';
import { IAttendanceAttemptLog } from '../types';
import { safeLocalStorage } from '../utils/safeStorage';

import { appLogger } from '../shared/logger';

interface EnrolledClassOption {
  _id: string;
  name: string;
  label?: string;
  isActive?: boolean;
  lifecycleState?: string;
  endDate?: string;
}

const getDaysInMonth = (year: number, monthOneBased: number): number => {
  return new Date(year, monthOneBased, 0).getDate();
};

const subtractOneMonthWithDayClamp = (dateKey: string): string => {
  const [yearPart, monthPart, dayPart] = dateKey.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return dateKey;
  }

  let targetYear = year;
  let targetMonth = month - 1;
  if (targetMonth < 1) {
    targetMonth = 12;
    targetYear -= 1;
  }

  const clampedDay = Math.min(day, getDaysInMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
};

const getPreviousMonthSameDayRange = () => {
  const todayKey = toISTDateString(nowIST());
  return {
    start: subtractOneMonthWithDayClamp(todayKey),
    end: todayKey,
  };
};

const normalizeClassOptions = (input: unknown): EnrolledClassOption[] => {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const normalized: EnrolledClassOption[] = [];

  for (const item of input) {
    const rawId = (item as any)?._id || (item as any)?.id || (item as any)?.classId || (item as any)?.classBatchId;
    const classId = typeof rawId === 'string' ? rawId : rawId?.toString?.();
    const className = (item as any)?.name || (item as any)?.className || (item as any)?.title || 'Unnamed Class';
    const isActive = (item as any)?.isActive;
    const lifecycleState = (item as any)?.lifecycleState;
    const endDate = (item as any)?.endDate || (item as any)?.endAt;

    let isEnded = isActive === false;
    const stateToken = String(lifecycleState || '').toUpperCase();
    if (stateToken === 'ARCHIVED') {
      isEnded = true;
    }
    if (!isEnded && endDate) {
      const endKey = toISTDateString(new Date(endDate));
      const todayKey = toISTDateString(nowIST());
      if (endKey < todayKey) {
        isEnded = true;
      }
    }

    const label = isEnded ? `${className} (Ended)` : className;

    if (!classId || seen.has(classId)) continue;
    seen.add(classId);
    normalized.push({
      _id: classId,
      name: className,
      label,
      isActive,
      lifecycleState,
      endDate: endDate?.toString?.() || (typeof endDate === 'string' ? endDate : undefined),
    });
  }

  return normalized;
};

const getPreferredClassFromUrl = (): string => {
  const params = new URLSearchParams(window.location.search);
  return params.get('classId') || params.get('classBatchId') || '';
};

const getStoredClass = (storageKey: string): string => {
  return safeLocalStorage.getItem(storageKey) || '';
};

const persistClassSelection = (storageKey: string, classId: string) => {
  if (classId) {
    safeLocalStorage.setItem(storageKey, classId);
  } else {
    safeLocalStorage.removeItem(storageKey);
  }
};

const MyAttendance: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();

  const [classes, setClasses] = useState<EnrolledClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const defaultRange = useMemo(() => getPreviousMonthSameDayRange(), []);
  const [analyticsStartDate, setAnalyticsStartDate] = useState(defaultRange.start);
  const [analyticsEndDate, setAnalyticsEndDate] = useState(defaultRange.end);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [isIssuePanelOpen, setIsIssuePanelOpen] = useState(false);
  const [attemptLogs, setAttemptLogs] = useState<IAttendanceAttemptLog[]>([]);
  const [attemptLogsLoading, setAttemptLogsLoading] = useState(false);
  const [attemptLogsError, setAttemptLogsError] = useState('');
  const [attemptStatusFilter, setAttemptStatusFilter] = useState<'ALL' | 'MARKED' | 'ALREADY_MARKED' | 'FAILED'>('ALL');

  const { user, isSuperAdmin, isCompanyAdmin, isManager, isPlatformOwner, isSessionAdmin } = useAuth();
  const isAdmin = isSuperAdmin || isCompanyAdmin || isManager || isPlatformOwner || isSessionAdmin;

  const [activeTab, setActiveTab] = useState<'analytics' | 'report' | 'approval'>('analytics');

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  const [automationConfigs, setAutomationConfigs] = useState<any[]>([]);

  const classSelectionStorageKey = useMemo(() => {
    const orgScope = (user?.organizationId || 'unknown-org').trim();
    const viewerScope = (user?.id || 'unknown-user').trim();
    const targetScope = (userId || 'self').trim();
    return `my-attendance:selected-class:${orgScope}:${viewerScope}:${targetScope}`;
  }, [user?.organizationId, user?.id, userId]);

  const fetchClasses = useCallback(async () => {
    try {
      const data = await getMySessions(userId);
      const classList = normalizeClassOptions(data);
      const preferredClassId = getPreferredClassFromUrl();
      const storedClassId = getStoredClass(classSelectionStorageKey);
      setClasses(classList);
      setSelectedClass((current) => {
        if (preferredClassId && classList.some((item: EnrolledClassOption) => item._id === preferredClassId)) {
          return preferredClassId;
        }
        if (storedClassId && classList.some((item: EnrolledClassOption) => item._id === storedClassId)) {
          return storedClassId;
        }
        if (current && classList.some((item: EnrolledClassOption) => item._id === current)) {
          return current;
        }
        return classList[0]?._id || '';
      });
    } catch (err) {
      appLogger.error('Error fetching classes:', err);
      setClasses([]);
      setSelectedClass('');
    }
  }, [userId, classSelectionStorageKey]);

  const handleRefreshDashboard = useCallback(async () => {
    if (!analyticsStartDate || !analyticsEndDate || !selectedClass) return;

    setAnalyticsLoading(true);
    try {
      const data = await getMyDashboard({
        userId,
        classId: selectedClass,
        startDate: analyticsStartDate,
        endDate: analyticsEndDate,
      });
      setAnalyticsData(data);
    } catch (err) {
      appLogger.error('Error fetching analytics:', err);
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsEndDate, analyticsStartDate, selectedClass, userId]);

  const fetchAutomationConfigs = useCallback(async () => {
    try {
      const response = await getEmailAutomationConfigs();
      setAutomationConfigs(response.data.data || []);
    } catch (err: any) {
      appLogger.error('Error fetching automation configs:', err);
    }
  }, []);

  const loadAttemptLogs = useCallback(async () => {
    if (!selectedClass || !analyticsStartDate || !analyticsEndDate) {
      setAttemptLogs([]);
      setAttemptLogsError('');
      return;
    }

    setAttemptLogsLoading(true);
    setAttemptLogsError('');
    try {
      const response = await getMyAttendanceAttempts({
        classId: selectedClass,
        userId,
        startDate: analyticsStartDate,
        endDate: analyticsEndDate,
        status: attemptStatusFilter === 'ALL' ? undefined : attemptStatusFilter,
        limit: 50,
        page: 1,
      });
      setAttemptLogs(Array.isArray(response.attempts) ? response.attempts : []);
    } catch (err: any) {
      appLogger.error('Error fetching attendance attempts:', err);
      setAttemptLogs([]);
      setAttemptLogsError(err?.response?.data?.msg || 'Failed to load attendance attempts.');
    } finally {
      setAttemptLogsLoading(false);
    }
  }, [selectedClass, analyticsStartDate, analyticsEndDate, userId, attemptStatusFilter]);

  useEffect(() => {
    fetchClasses();

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'approval' && isAdmin) {
      setActiveTab('approval');
    } else if (tabParam === 'report') {
      setActiveTab('report');
    }
  }, [fetchClasses, isAdmin]);

  useEffect(() => {
    if (selectedClass && analyticsStartDate && analyticsEndDate) {
      handleRefreshDashboard();
    } else {
      setAnalyticsData(null);
    }
  }, [selectedClass, analyticsStartDate, analyticsEndDate, handleRefreshDashboard]);

  useEffect(() => {
    fetchAutomationConfigs();
  }, [fetchAutomationConfigs]);

  useEffect(() => {
    loadAttemptLogs();
  }, [loadAttemptLogs]);

  useEffect(() => {
    if (classes.length === 0) {
      return;
    }
    const isValidSelection = classes.some((item) => item._id === selectedClass);
    if (isValidSelection) {
      persistClassSelection(classSelectionStorageKey, selectedClass);
      return;
    }
    if (!selectedClass) {
      persistClassSelection(classSelectionStorageKey, '');
    }
  }, [classes, selectedClass, classSelectionStorageKey]);

  const handleToggleAutomation = async (id: string) => {
    try {
      const toastId = toast.loading('Updating automation...');
      await toggleEmailAutomation(id);
      toast.success('Automation status updated!', { id: toastId });
      fetchAutomationConfigs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update automation');
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    try {
      const toastId = toast.loading('Deleting automation...');
      await deleteEmailAutomation(id);
      toast.success('Automation deleted successfully!', { id: toastId });
      fetchAutomationConfigs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete automation');
    }
  };

  const statusPillClass = (status: IAttendanceAttemptLog['status']) => {
    if (status === 'MARKED') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    if (status === 'ALREADY_MARKED') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    if (status === 'FAILED') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  const methodLabel = (attempt: IAttendanceAttemptLog) => {
    const method = attempt.markingMethod ? attempt.markingMethod.replace('_', ' ') : 'UNKNOWN';
    return `${method} / ${attempt.markingChannel || 'N/A'}`;
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-text-primary-light dark:text-text-primary-dark mb-2">
              {userId ? 'User Attendance' : 'My Attendance'}
            </h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium">
              Track attendance analytics and logs by class
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsShareModalOpen(true)}
              disabled={!selectedClass}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark font-bold hover:bg-background-light dark:hover:bg-background-dark transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-xl">share</span>
              <span>Share</span>
            </button>
            <button
              onClick={() => setIsDownloadModalOpen(true)}
              disabled={!selectedClass}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#181511] dark:bg-primary text-white font-bold hover:scale-105 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-xl">download</span>
              <span>Download Report</span>
            </button>
          </div>
        </div>

        {activeTab !== 'approval' && (
          <AnalyticsFilters
            classes={classes}
            selectedClass={selectedClass}
            onClassChange={setSelectedClass}
            startDate={analyticsStartDate}
            onStartDateChange={setAnalyticsStartDate}
            endDate={analyticsEndDate}
            onEndDateChange={setAnalyticsEndDate}
            onViewReport={handleRefreshDashboard}
            loading={analyticsLoading}
          />
        )}

        <div className="flex flex-wrap items-center p-1.5 bg-border-light/50 dark:bg-border-dark/50 rounded-2xl w-fit mb-8 gap-1">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'analytics' ? 'bg-surface-light dark:bg-surface-dark text-primary shadow-md' : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'}`}
          >
            <BarChart3 size={18} />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'report' ? 'bg-surface-light dark:bg-surface-dark text-primary shadow-md' : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'}`}
          >
            <TableIcon size={18} />
            <span>Attendance Log</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('approval')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'approval' ? 'bg-surface-light dark:bg-surface-dark text-primary shadow-md' : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'}`}
            >
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              <span>Approval Queue</span>
            </button>
          )}
        </div>

        <div className="mt-8">
          {activeTab === 'analytics' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AnalyticsTab analyticsData={analyticsData} loading={analyticsLoading} />
            </div>
          )}

          {activeTab === 'report' && selectedClass && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AttendanceReportTab
                userId={userId}
                classId={selectedClass}
                startDate={analyticsStartDate}
                endDate={analyticsEndDate}
              />
              <div className="mt-6 rounded-2xl border border-border-light bg-surface-light p-6 shadow-sm dark:border-border-dark dark:bg-surface-dark">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-text-primary-light dark:text-text-primary-dark">
                      Attendance Attempts
                    </h3>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      Every successful and failed marking attempt for this class and date range.
                    </p>
                  </div>
                  <select
                    value={attemptStatusFilter}
                    onChange={(event) => setAttemptStatusFilter(event.target.value as typeof attemptStatusFilter)}
                    className="rounded-xl border border-border-light bg-background-light px-3 py-2 text-sm font-semibold text-text-primary-light focus:border-primary focus:outline-none dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
                  >
                    <option value="ALL">All statuses</option>
                    <option value="MARKED">Marked</option>
                    <option value="ALREADY_MARKED">Already Marked</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>

                {attemptLogsLoading ? (
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Loading attendance attempts...</p>
                ) : attemptLogsError ? (
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">{attemptLogsError}</p>
                ) : attemptLogs.length === 0 ? (
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    No attempts found for the selected filters.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {attemptLogs.map((attempt) => (
                      <details
                        key={attempt.id}
                        className="rounded-xl border border-border-light bg-background-light p-4 dark:border-border-dark dark:bg-background-dark"
                      >
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusPillClass(attempt.status)}`}>
                                  {attempt.status}
                                </span>
                                <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                                  {new Date(attempt.attemptedAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="truncate text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                                {attempt.msg || attempt.reason || 'No message'}
                              </p>
                              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                {methodLabel(attempt)}
                              </p>
                            </div>
                            <span className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark">
                              {attempt.id}
                            </span>
                          </div>
                        </summary>

                        {Array.isArray(attempt.validationTimeline) && attempt.validationTimeline.length > 0 && (
                          <ul className="mt-3 space-y-2 border-t border-border-light pt-3 dark:border-border-dark">
                            {attempt.validationTimeline.map((step, index) => (
                              <li key={`${attempt.id}-${step.key}-${index}`} className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">
                                  {step.label}
                                </span>
                                {`: ${step.detail}`}
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'report' && !selectedClass && (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-10 text-center text-text-secondary-light dark:text-text-secondary-dark">
              No classes available for attendance logs.
            </div>
          )}

          {activeTab === 'approval' && isAdmin && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ReportApprovalPanel />
            </div>
          )}
        </div>

        {!userId && automationConfigs.length > 0 && (
          <div className="mt-8">
            <AutomationIndicator
              configs={automationConfigs}
              onToggle={handleToggleAutomation}
              onDelete={handleDeleteAutomation}
              onEdit={() => setIsShareModalOpen(true)}
            />
          </div>
        )}
      </div>

      <ShareReportModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        classId={selectedClass}
        startDate={analyticsStartDate}
        endDate={analyticsEndDate}
        userId={userId}
        initialOrgName={user?.organizationName}
        initialOrgLogo={user?.organizationLogo}
      />

      <DownloadReportModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        classId={selectedClass}
        startDate={analyticsStartDate}
        endDate={analyticsEndDate}
        userId={userId}
        initialOrgName={user?.organizationName}
        initialOrgLogo={user?.organizationLogo}
      />

      <button
        onClick={() => setIsIssuePanelOpen(true)}
        disabled={classes.length === 0}
        className="fixed bottom-6 right-6 z-40 h-14 px-5 rounded-2xl shadow-xl bg-primary hover:bg-primary-hover disabled:bg-border-light dark:disabled:bg-border-dark disabled:text-text-secondary-light dark:disabled:text-text-secondary-dark disabled:cursor-not-allowed text-white font-black flex items-center gap-2 transition-all hover:scale-[1.02]"
      >
        <CircleAlert size={18} />
        Attendance Issues
      </button>

      <AttendanceIssuePanel
        isOpen={isIssuePanelOpen}
        onClose={() => setIsIssuePanelOpen(false)}
        classId={selectedClass}
        classes={classes}
        onClassChange={setSelectedClass}
        defaultSessionDate={analyticsEndDate}
        canReview={isAdmin}
        onIssueUpdated={handleRefreshDashboard}
      />
    </div>
  );
};

export default MyAttendance;
