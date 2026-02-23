import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { nowIST, toISTDateString, formatIST } from '../utils/time';
import { IClassBatch } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import jsPDF from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import ReportApprovalPanel from '../components/attendance/reporting/ReportApprovalPanel';
import SessionAttendanceView from '../components/attendance/SessionAttendanceView';
import SkeletonCard from '../components/SkeletonCard';
import { appLogger } from '../shared/logger';

interface AnalyticsData {
  timeline: Array<{ date: string; percentage: number; lateCount?: number }>;
  summary: { present: number; late: number; absent: number };
  topPerformers: Array<{ name: string; email: string; percentage: number; verified: number; assigned: number }>;
  defaulters: Array<{ name: string; email: string; percentage: number; verified: number; assigned: number }>;
}

interface SessionLog {
  _id: string;
  name: string;
  date: string;
  dateStr?: string;
  totalAssigned: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendancePercentage: number;
  status: string;
  startTime?: string;
  endTime?: string;
}

const AttendanceReport: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState<IClassBatch[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { isSuperAdmin, isCompanyAdmin, isManager, isPlatformOwner, isSessionAdmin } = useAuth();
  const isAdmin = isSuperAdmin || isCompanyAdmin || isManager || isPlatformOwner || isSessionAdmin;

  const [activeTab, setActiveTab] = useState<'analytics' | 'logs' | 'approval'>('analytics');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [error, setError] = useState('');

  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [viewingSessionDate, setViewingSessionDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      setIsLoadingFilters(true);
      setError('');
      try {
        const { data } = await api.get('/api/classes');
        setClasses(data || []);
      } catch (err: any) {
        if (err.response?.status === 401) {
          setError('You are not authorized. Please log in again.');
        } else {
          setError('Failed to load classes. Please try again.');
        }
        appLogger.error(err);
      } finally {
        setIsLoadingFilters(false);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    const classBatchId = searchParams.get('classBatchId');
    const tab = searchParams.get('tab');
    if (classBatchId) setSelectedClass(classBatchId);
    if (tab === 'logs' || tab === 'analytics' || tab === 'approval') setActiveTab(tab as any);
  }, [searchParams]);

  useEffect(() => {
    const todayIST = nowIST();
    const thirtyDaysAgoIST = todayIST - (30 * 24 * 60 * 60 * 1000);
    setEndDate(toISTDateString(todayIST));
    setStartDate(toISTDateString(thirtyDaysAgoIST));
  }, []);

  const handleViewReport = async () => {
    if (!selectedClass || !startDate || !endDate) {
      setError('Please select a class and date range.');
      return;
    }

    setIsLoading(true);
    setError('');
    setAnalyticsData(null);
    setSessionLogs([]);

    try {
      if (activeTab === 'analytics') {
        const { data } = await api.get('/api/reports/analytics', { params: { classBatchId: selectedClass, startDate, endDate } });
        setAnalyticsData(data);
      } else if (activeTab === 'logs') {
        const { data } = await api.get('/api/reports/logs', { params: { classBatchId: selectedClass, startDate, endDate } });
        setSessionLogs(data || []);
      }
    } catch (err: any) {
      if (err.response?.status === 403) setError('You are not authorized to view reports.');
      else if (err.response?.status === 400) setError(err.response.data.msg || 'Invalid request. Please check your selections.');
      else setError(err.response?.data?.msg || 'Failed to fetch data. Please try again.');
      appLogger.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const classBatchId = searchParams.get('classBatchId');
    if (classBatchId && selectedClass === classBatchId && startDate && endDate && classes.length > 0) {
      const timer = setTimeout(() => {
        if (!selectedClass || !startDate || !endDate) return;
        handleViewReport();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedClass, startDate, endDate, classes.length, searchParams, activeTab]);

  const downloadSessionCSV = async (sessionId: string, sessionName: string, date: string) => {
    try {
      const { data } = await api.get(`/api/attendance/session/${sessionId}/export`, {
        params: { sessionDate: date, date, format: 'CSV' }
      });
      const records = data.exportData || [];
      if (records.length === 0) {
        alert('No attendance records found for this session.');
        return;
      }
      const headers = ['User Name', 'Email', 'Role', 'Check-in Time', 'Status', 'Is Late', 'Late By (min)', 'Location Verified', 'Updated By', 'Update Reason'];
      const rows = records.map((record: any) => [
        record.name || 'N/A', record.email || 'N/A', record.role || 'N/A', record.checkInTime || 'N/A',
        record.status || 'ABSENT', record.isLate || 'No', record.lateByMinutes || 0,
        record.locationVerified || 'No', record.updatedBy || '', record.updateReason || ''
      ]);
      const csvContent = [headers.join(','), ...rows.map((row: any[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${sessionName.replace(/[^a-z0-9]/gi, '_')}_Attendance_${date}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      appLogger.error('Failed to download CSV:', err);
      setError('Failed to download CSV. Please try again.');
    }
  };

  const downloadSessionPDF = async (sessionId: string, sessionName: string, date: string) => {
    try {
      const { data } = await api.get(`/api/attendance/session/${sessionId}/export`, {
        params: { sessionDate: date, date, format: 'PDF' }
      });
      const records = data.exportData || [];
      if (records.length === 0) {
        alert('No attendance records found for this session.');
        return;
      }
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const startY = 20;
      let yPos = startY;

      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(sessionName, margin, yPos);
      yPos += 10;
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Attendance Report - ${formatDate(date)}`, margin, yPos);
      yPos += 10;

      const summary = data.summary || {
        total: records.length,
        present: records.filter((r: any) => r.status === 'PRESENT').length,
        absent: records.filter((r: any) => r.status === 'ABSENT').length,
        late: records.filter((r: any) => r.status === 'LATE').length
      };

      pdf.setFontSize(10);
      pdf.text(`Total: ${summary.total} | Present: ${summary.present} | Late: ${summary.late} | Absent: ${summary.absent}`, margin, yPos);
      yPos += 15;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      const colWidths = [50, 60, 40, 30];
      const headers = ['Name', 'Email', 'Check-in Time', 'Status'];
      let xPos = margin;
      headers.forEach((header, index) => { pdf.text(header, xPos, yPos); xPos += colWidths[index]; });
      yPos += 8;
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
      yPos += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      records.forEach((record: any, index: number) => {
        const rowData = [record.name || 'N/A', record.email || 'N/A', record.checkInTime || 'N/A', record.status || 'ABSENT'];
        const splitCells = rowData.map((cell, cellIndex) => pdf.splitTextToSize(String(cell), colWidths[cellIndex] - 2));
        const maxLines = Math.max(...splitCells.map(cell => cell.length));
        const lineHeight = 6;
        if (yPos + maxLines * lineHeight > pageHeight - 20) { pdf.addPage(); yPos = startY; }
        xPos = margin;
        splitCells.forEach((cellText, cellIndex) => {
          const cellYStart = yPos;
          if (Array.isArray(cellText)) cellText.forEach((line, lineIndex) => pdf.text(line, xPos, cellYStart + lineIndex * lineHeight));
          else pdf.text(cellText, xPos, cellYStart);
          xPos += colWidths[cellIndex];
        });
        yPos += maxLines * lineHeight + 2;
        if (index < records.length - 1) { pdf.setLineWidth(0.1); pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2); yPos += 2; }
      });
      pdf.save(`${sessionName.replace(/[^a-z0-9]/gi, '_')}_Attendance_${date}.pdf`);
    } catch (err: any) {
      appLogger.error('Failed to download PDF:', err);
      setError('Failed to download PDF. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    try { return formatIST(new Date(dateString).getTime(), { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return dateString; }
  };

  const pieData = analyticsData
    ? [
      { name: 'Present', value: analyticsData.summary.present, color: '#22c55e' },
      { name: 'Late', value: analyticsData.summary.late || 0, color: '#eab308' },
      { name: 'Absent', value: analyticsData.summary.absent, color: '#ef4444' }
    ].filter(item => item.value > 0) : [];

  if (isLoadingFilters) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden p-4 md:p-10">
        <div className="flex flex-col gap-6 w-full">
          <SkeletonCard variant="card" className="h-[200px]" />
          <div className="flex gap-4">
            <div className="w-1/2">
              <SkeletonCard variant="card" className="h-[300px]" />
            </div>
            <div className="w-1/2">
              <SkeletonCard variant="card" className="h-[300px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-12 flex flex-1 justify-center">
          <div className="layout-content-container flex flex-col w-full max-w-7xl flex-1">
            <div className="flex min-w-72 flex-col gap-1 sm:gap-3 mb-4 sm:mb-8">
              <p className="text-[#181511] dark:text-white text-2xl sm:text-3xl lg:text-4xl font-black leading-tight tracking-[-0.033em]">
                Attendance Report
              </p>
              <p className="text-[#8a7b60] dark:text-gray-400 text-sm sm:text-base font-normal leading-normal">
                View class-wise attendance analytics, statistics, and detailed session logs.
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20 p-4 rounded-xl flex items-center">
                <span className="material-symbols-outlined mr-2">error</span>
                {error}
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-3 sm:p-6 lg:p-8 mb-4 sm:mb-8">
              <h2 className="text-[#181511] dark:text-white text-base sm:text-xl font-bold leading-tight tracking-[-0.015em] mb-3 sm:mb-5 flex items-center">
                <span className="material-symbols-outlined text-[#f04129] mr-1 sm:mr-2 text-lg sm:text-2xl">filter_alt</span>
                <span className="text-sm sm:text-xl">Select Class & Date Range</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 items-end">
                <label className="flex flex-col flex-1">
                  <p className="text-[#181511] dark:text-gray-200 text-xs sm:text-sm font-medium leading-normal pb-1 sm:pb-2">Class/Batch</p>
                  <div className="relative">
                    <select
                      className="form-select appearance-none flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-10 sm:h-12 px-2 sm:px-3 py-2 sm:py-3 text-sm sm:text-base font-normal leading-normal"
                      value={selectedClass}
                      onChange={(e) => { setSelectedClass(e.target.value); setAnalyticsData(null); setSessionLogs([]); setError(''); }}
                      disabled={isLoading}
                    >
                      <option value="">-- Select Class --</option>
                      {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7b60] dark:text-gray-400">unfold_more</span>
                  </div>
                </label>

                <label className="flex flex-col flex-1">
                  <p className="text-[#181511] dark:text-gray-200 text-xs sm:text-sm font-medium leading-normal pb-1 sm:pb-2">Start Date</p>
                  <input
                    type="date" value={startDate} disabled={isLoading}
                    onChange={(e) => { setStartDate(e.target.value); setAnalyticsData(null); setSessionLogs([]); setError(''); }}
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-10 sm:h-12 px-2 sm:px-3 py-2 sm:py-3 text-sm sm:text-base font-normal leading-normal"
                  />
                </label>

                <label className="flex flex-col flex-1">
                  <p className="text-[#181511] dark:text-gray-200 text-xs sm:text-sm font-medium leading-normal pb-1 sm:pb-2">End Date</p>
                  <input
                    type="date" value={endDate} disabled={isLoading}
                    onChange={(e) => { setEndDate(e.target.value); setAnalyticsData(null); setSessionLogs([]); setError(''); }}
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-10 sm:h-12 px-2 sm:px-3 py-2 sm:py-3 text-sm sm:text-base font-normal leading-normal"
                  />
                </label>

                <button
                  className="flex w-full min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 sm:h-12 px-4 sm:px-5 bg-gradient-to-r from-orange-500 to-[#f04129] text-white gap-1 sm:gap-2 text-sm sm:text-base font-bold leading-normal tracking-[0.015em] hover:from-orange-600 hover:to-[#d63a25] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  onClick={handleViewReport}
                  disabled={isLoading || !selectedClass || !startDate || !endDate}
                >
                  <span className="material-symbols-outlined text-white">analytics</span>
                  <span className="truncate">View Report</span>
                </button>
              </div>
            </div>

            {(analyticsData || sessionLogs.length > 0) && (
              <div className="mb-4 sm:mb-6 flex gap-1 sm:gap-2 border-b border-[#e6e2db] dark:border-slate-700">
                <button
                  onClick={() => { setActiveTab('analytics'); if (selectedClass && startDate && endDate) handleViewReport(); }}
                  className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'analytics' ? 'bg-white dark:bg-slate-800 text-[#f04129] border-b-2 border-[#f04129]' : 'text-gray-500 dark:text-gray-400 hover:text-[#181511] dark:hover:text-white'}`}
                >
                  <span className="material-symbols-outlined align-middle mr-2">analytics</span> Analytics
                </button>
                <button
                  onClick={() => { setActiveTab('logs'); if (selectedClass && startDate && endDate) handleViewReport(); }}
                  className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'logs' ? 'bg-white dark:bg-slate-800 text-[#f04129] border-b-2 border-[#f04129]' : 'text-gray-500 dark:text-gray-400 hover:text-[#181511] dark:hover:text-white'}`}
                >
                  <span className="material-symbols-outlined align-middle mr-2">description</span> Attendance Logs
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('approval')}
                    className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'approval' ? 'bg-white dark:bg-slate-800 text-[#f04129] border-b-2 border-[#f04129]' : 'text-gray-500 dark:text-gray-400 hover:text-[#181511] dark:hover:text-white'}`}
                  >
                    <span className="material-symbols-outlined align-middle mr-2">verified_user</span> Approval Queue
                  </button>
                )}
              </div>
            )}

            {!analyticsData && sessionLogs.length === 0 && isAdmin && (
              <div className="mb-4 sm:mb-6 flex gap-1 sm:gap-2 border-b border-[#e6e2db] dark:border-slate-700">
                <button
                  onClick={() => setActiveTab('approval')}
                  className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'approval' ? 'bg-white dark:bg-slate-800 text-[#f04129] border-b-2 border-[#f04129]' : 'text-gray-500 dark:text-gray-400 hover:text-[#181511] dark:hover:text-white'}`}
                >
                  <span className="material-symbols-outlined align-middle mr-2">verified_user</span> Approval Queue
                </button>
              </div>
            )}

            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-4">
                <SkeletonCard variant="card" className="h-[250px]" />
                <SkeletonCard variant="card" className="h-[250px]" />
                <SkeletonCard variant="card" className="h-[250px]" />
                <SkeletonCard variant="card" className="h-[250px]" />
              </div>
            )}

            {!isLoading && activeTab === 'approval' && isAdmin && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ReportApprovalPanel />
              </div>
            )}

            {!isLoading && activeTab === 'analytics' && analyticsData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6">
                  <h3 className="text-[#181511] dark:text-white text-lg font-bold mb-4 flex items-center">
                    <span className="material-symbols-outlined text-[#f04129] mr-2">trending_up</span> Attendance Trend
                  </h3>
                  {analyticsData.timeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={256}>
                      <LineChart data={analyticsData.timeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e6e2db" className="dark:stroke-slate-700" />
                        <XAxis dataKey="date" stroke="#8a7b60" className="dark:stroke-gray-400" tick={{ fill: '#8a7b60', className: 'dark:fill-gray-400' }} style={{ fontSize: '12px' }} />
                        <YAxis stroke="#8a7b60" className="dark:stroke-gray-400" tick={{ fill: '#8a7b60', className: 'dark:fill-gray-400' }} style={{ fontSize: '12px' }} domain={[0, 100]} label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', fill: '#8a7b60', className: 'dark:fill-gray-400' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e6e2db', borderRadius: '8px', color: '#181511' }} />
                        <Line type="monotone" dataKey="percentage" stroke="#f04129" strokeWidth={2} dot={{ fill: '#f04129', r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="h-64 flex items-center justify-center text-[#8a7b60] dark:text-gray-400">No data available</div>}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6">
                  <h3 className="text-[#181511] dark:text-white text-lg font-bold mb-4 flex items-center">
                    <span className="material-symbols-outlined text-[#f04129] mr-2">pie_chart</span> Overall Status
                  </h3>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={256}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`} outerRadius={80} dataKey="value">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e6e2db', borderRadius: '8px', color: '#181511' }} />
                        <Legend wrapperStyle={{ fontSize: '14px', color: '#8a7b60' }} className="dark:text-gray-400" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="h-64 flex items-center justify-center text-[#8a7b60] dark:text-gray-400">No data available</div>}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6">
                  <h3 className="text-[#181511] dark:text-white text-lg font-bold mb-4 flex items-center">
                    <span className="material-symbols-outlined text-[#f04129] mr-2">emoji_events</span> Top 5 Performers
                  </h3>
                  {analyticsData.topPerformers.length > 0 ? (
                    <div className="space-y-3">
                      {analyticsData.topPerformers.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-lg font-bold text-green-700 dark:text-green-400 min-w-[24px]">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#181511] dark:text-white truncate">{p.name}</p>
                              <p className="text-xs text-[#8a7b60] dark:text-gray-400 truncate">{p.email}</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-full text-sm font-semibold">{p.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : <div className="h-64 flex items-center justify-center text-[#8a7b60] dark:text-gray-400">No performers data</div>}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6">
                  <h3 className="text-[#181511] dark:text-white text-lg font-bold mb-4 flex items-center">
                    <span className="material-symbols-outlined text-[#f04129] mr-2">warning</span> Top 5 Defaulters
                  </h3>
                  {analyticsData.defaulters.length > 0 ? (
                    <div className="space-y-3">
                      {analyticsData.defaulters.map((d, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-lg font-bold text-red-700 dark:text-red-400 min-w-[24px]">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#181511] dark:text-white truncate">{d.name}</p>
                              <p className="text-xs text-[#8a7b60] dark:text-gray-400 truncate">{d.email}</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded-full text-sm font-semibold">{d.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : <div className="h-64 flex items-center justify-center text-[#8a7b60] dark:text-gray-400">No defaulters data</div>}
                </div>
              </div>
            )}

            {!isLoading && activeTab === 'logs' && sessionLogs && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6 overflow-hidden">
                <h3 className="text-[#181511] dark:text-white text-xl font-bold mb-6">Attendance Logs</h3>
                {sessionLogs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sessionLogs.map(log => (
                      <div key={log._id} className="relative rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4">
                        <div>
                          <h4 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark truncate">{log.name}</h4>
                          <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">{formatDate(log.dateStr || log.date)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg text-center">
                            <div className="font-bold text-green-600 dark:text-green-400">{log.presentCount}</div>
                            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Present</div>
                          </div>
                          <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-center">
                            <div className="font-bold text-red-600 dark:text-red-400">{log.absentCount}</div>
                            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Absent</div>
                          </div>
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg text-center">
                            <div className="font-bold text-yellow-600 dark:text-yellow-400">{log.lateCount}</div>
                            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Late</div>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-center">
                            <div className="font-bold text-blue-600 dark:text-blue-400">{log.attendancePercentage.toFixed(1)}%</div>
                            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Rate</div>
                          </div>
                        </div>
                        <div className="mt-auto grid grid-cols-1 gap-2">
                          <button onClick={() => { setViewingSessionId(log._id); setViewingSessionDate(log.date || log.dateStr!); }} className="w-full py-2 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20 transition-colors">
                            View Details
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => downloadSessionCSV(log._id, log.name, log.date || log.dateStr!)} className="py-2 bg-gray-100 dark:bg-gray-800 text-text-primary-light dark:text-text-primary-dark text-xs font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                              CSV
                            </button>
                            <button onClick={() => downloadSessionPDF(log._id, log.name, log.date || log.dateStr!)} className="py-2 bg-gray-100 dark:bg-gray-800 text-text-primary-light dark:text-text-primary-dark text-xs font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                              PDF
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-text-secondary-light dark:text-text-secondary-dark">
                    No session logs found for the selected criteria.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewingSessionId && viewingSessionDate && (
        <SessionAttendanceView
          sessionId={viewingSessionId}
          sessionDate={viewingSessionDate}
          onClose={() => {
            setViewingSessionId(null);
            setViewingSessionDate(null);
          }}
        />
      )}
    </div>
  );
};

export default AttendanceReport;
