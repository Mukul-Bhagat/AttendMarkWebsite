import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { BarChart3, Table as TableIcon } from 'lucide-react';
import { nowIST, toISTDateString } from '../utils/time';
import { getMyAnalytics, getMySessions } from '../api/analyticsApi';
import AnalyticsFilters from '../components/attendance/AnalyticsFilters';
import AnalyticsTab from '../components/attendance/AnalyticsTab';
import AttendanceReportTab from '../components/attendance/reporting/AttendanceReportTab';
import DownloadReportModal from '../components/attendance/reporting/DownloadReportModal';
import ShareReportModal from '../components/attendance/reporting/ShareReportModal';
import { useAuth } from '../contexts/AuthContext';
import ReportApprovalPanel from '../components/attendance/reporting/ReportApprovalPanel';

const MyAttendance: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const [userName, setUserName] = useState<string>('');

  // Analytics filters state
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const { user, isSuperAdmin, isCompanyAdmin, isManager, isPlatformOwner, isSessionAdmin } = useAuth();
  const isAdmin = isSuperAdmin || isCompanyAdmin || isManager || isPlatformOwner || isSessionAdmin;

  const [activeTab, setActiveTab] = useState<'analytics' | 'report' | 'approval'>('analytics');

  // Reporting Modals state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  useEffect(() => {
    const fetchBasicInfo = async () => {
      try {
        const endpoint = userId ? `/api/attendance/user/${userId}` : '/api/attendance/me';
        const { data } = await api.get(endpoint);

        if (userId && data.length > 0) {
          const firstRecord = data[0];
          if (firstRecord.userId?.profile) {
            setUserName(`${firstRecord.userId.profile.firstName} ${firstRecord.userId.profile.lastName}`);
          }
        }
      } catch (err: any) {
        console.error('Error fetching attendance info:', err);
      }
    };

    const fetchSessions = async () => {
      try {
        const data = await getMySessions(userId);
        setSessions(data || []);
      } catch (err) {
        console.error('Error fetching sessions:', err);
      }
    };

    fetchBasicInfo();
    fetchSessions();

    // Set default date range (last 30 days)
    const todayIST = nowIST();
    const thirtyDaysAgoIST = todayIST - (30 * 24 * 60 * 60 * 1000);
    setAnalyticsEndDate(toISTDateString(todayIST));
    setAnalyticsStartDate(toISTDateString(thirtyDaysAgoIST));
  }, [userId]);

  const handleFetchAnalytics = async () => {
    if (!analyticsStartDate || !analyticsEndDate) return;

    setAnalyticsLoading(true);
    try {
      const data = await getMyAnalytics({
        userId,
        sessionId: selectedSession,
        startDate: analyticsStartDate,
        endDate: analyticsEndDate,
      });
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Initial fetch when dates are set if they were pre-filled
  useEffect(() => {
    if (analyticsStartDate && analyticsEndDate) {
      handleFetchAnalytics();
    }
  }, [userId]);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-text-primary-light dark:text-text-primary-dark mb-2">
              {userId ? `${userName}'s Attendance` : 'My Attendance'}
            </h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium">
              Track your presence, analytics and session history
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark font-bold hover:bg-background-light dark:hover:bg-background-dark transition-all shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-xl">share</span>
              <span>Share</span>
            </button>
            <button
              onClick={() => setIsDownloadModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#181511] dark:bg-primary text-white font-bold hover:scale-105 transition-all shadow-lg active:scale-95"
            >
              <span className="material-symbols-outlined text-xl">download</span>
              <span>Download Report</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
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

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'analytics' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AnalyticsFilters
                sessions={sessions}
                selectedSession={selectedSession}
                onSessionChange={setSelectedSession}
                startDate={analyticsStartDate}
                onStartDateChange={setAnalyticsStartDate}
                endDate={analyticsEndDate}
                onEndDateChange={setAnalyticsEndDate}
                onViewReport={handleFetchAnalytics}
                loading={analyticsLoading}
              />
              <AnalyticsTab analyticsData={analyticsData} loading={analyticsLoading} />
            </div>
          )}

          {activeTab === 'report' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AttendanceReportTab
                userId={userId}
              />
            </div>
          )}

          {activeTab === 'approval' && isAdmin && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ReportApprovalPanel />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ShareReportModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        startDate={analyticsStartDate}
        endDate={analyticsEndDate}
        userId={userId}
        initialOrgName={user?.organizationName}
        initialOrgLogo={user?.organizationLogo}
      />

      <DownloadReportModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        startDate={analyticsStartDate}
        endDate={analyticsEndDate}
        userId={userId}
        initialOrgName={user?.organizationName}
        initialOrgLogo={user?.organizationLogo}
      />
    </div>
  );
};

export default MyAttendance;
