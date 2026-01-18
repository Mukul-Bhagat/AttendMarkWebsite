import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { IClassBatch } from '../types';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import SessionAttendanceView from '../components/attendance/SessionAttendanceView';
import ActionMenu from '../components/ActionMenu';

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
  dateStr?: string; // YYYY-MM-DD
  totalUsers?: number; // Legacy or alternative name? Backend sends totalAssigned
  totalAssigned: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendancePercentage: number;
  status: string;
  startTime?: string;
  endTime?: string;
}

// SessionAttendanceRecord - REMOVED (unused, replaced by SessionAttendanceView component)

const AttendanceReport: React.FC = () => {
  // Force Mark removed - use "Manage" button in SessionAttendanceView
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState<IClassBatch[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<'analytics' | 'logs'>('analytics');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [error, setError] = useState('');

  // Viewing session attendance state
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [viewingSessionDate, setViewingSessionDate] = useState<string | null>(null);

  // Fetch classes on mount
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
        console.error(err);
      } finally {
        setIsLoadingFilters(false);
      }
    };
    fetchClasses();
  }, []);

  // Handle incoming query params (classBatchId, tab)
  useEffect(() => {
    const classBatchId = searchParams.get('classBatchId');
    const tab = searchParams.get('tab');

    if (classBatchId) {
      setSelectedClass(classBatchId);
    }

    if (tab === 'logs' || tab === 'analytics') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Fetch analytics when "View Report" is clicked
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
        const { data } = await api.get('/api/reports/analytics', {
          params: {
            classBatchId: selectedClass,
            startDate,
            endDate,
          },
        });
        setAnalyticsData(data);
      } else if (activeTab === 'logs') {
        const { data } = await api.get('/api/reports/logs', {
          params: {
            classBatchId: selectedClass,
            startDate,
            endDate,
          },
        });
        setSessionLogs(data || []);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You are not authorized to view reports.');
      } else if (err.response?.status === 400) {
        setError(err.response.data.msg || 'Invalid request. Please check your selections.');
      } else {
        setError(err.response?.data?.msg || 'Failed to fetch data. Please try again.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch report when classBatchId is provided via query params
  useEffect(() => {
    const classBatchId = searchParams.get('classBatchId');
    if (classBatchId && selectedClass === classBatchId && startDate && endDate && classes.length > 0) {
      // Small delay to ensure state is set
      const timer = setTimeout(() => {
        if (!selectedClass || !startDate || !endDate) return;

        setIsLoading(true);
        setError('');
        setAnalyticsData(null);
        setSessionLogs([]);

        const fetchData = async () => {
          try {
            if (activeTab === 'analytics') {
              const { data } = await api.get('/api/reports/analytics', {
                params: {
                  classBatchId: selectedClass,
                  startDate,
                  endDate,
                },
              });
              setAnalyticsData(data);
            } else if (activeTab === 'logs') {
              const { data } = await api.get('/api/reports/logs', {
                params: {
                  classBatchId: selectedClass,
                  startDate,
                  endDate,
                },
              });
              setSessionLogs(data || []);
            }
          } catch (err: any) {
            if (err.response?.status === 403) {
              setError('You are not authorized to view reports.');
            } else if (err.response?.status === 400) {
              setError(err.response.data.msg || 'Invalid request. Please check your selections.');
            } else {
              setError(err.response?.data?.msg || 'Failed to fetch data. Please try again.');
            }
            console.error(err);
          } finally {
            setIsLoading(false);
          }
        };

        fetchData();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedClass, startDate, endDate, classes.length, searchParams, activeTab]);

  // fetchSessionAttendanceDetails - REMOVED (unused)
  // This functionality has been replaced by SessionAttendanceView component

  // Download CSV for a specific session
  const downloadSessionCSV = async (sessionId: string, sessionName: string, date: string) => {
    try {
      // Use the dedicated export endpoint which returns fresh attendance data including manual corrections
      const { data } = await api.get(`/api/attendance/session/${sessionId}/export`, {
        params: {
          date: date, // Make sure to pass the date for potential handling of recurring sessions
          format: 'CSV'
        }
      });

      const records = data.exportData || [];

      if (records.length === 0) {
        alert('No attendance records found for this session.');
        return;
      }

      // CSV Headers
      const headers = ['User Name', 'Email', 'Role', 'Check-in Time', 'Status', 'Is Late', 'Late By (min)', 'Location Verified', 'Updated By', 'Update Reason'];

      // CSV Rows
      const rows = records.map((record: any) => {
        return [
          record.name || 'N/A',
          record.email || 'N/A',
          record.role || 'N/A',
          record.checkInTime || 'N/A',
          record.status || 'ABSENT',
          record.isLate || 'No',
          record.lateByMinutes || 0,
          record.locationVerified || 'No',
          record.updatedBy || '',
          record.updateReason || ''
        ];
      });

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${sessionName.replace(/[^a-z0-9]/gi, '_')}_Attendance_${date}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Failed to download CSV:', err);
      setError('Failed to download CSV. Please try again.');
    }
  };


  // Download PDF for a specific session
  const downloadSessionPDF = async (sessionId: string, sessionName: string, date: string) => {
    try {
      // Use the dedicated export endpoint which returns fresh attendance data including manual corrections
      const { data } = await api.get(`/api/attendance/session/${sessionId}/export`, {
        params: {
          date: date, // Make sure to pass the date for potential handling of recurring sessions
          format: 'PDF'
        }
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

      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(sessionName, margin, yPos);
      yPos += 10;

      // Subtitle
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Attendance Report - ${formatDate(date)}`, margin, yPos);
      yPos += 10;

      // Summary
      const summary = data.summary || {
        total: records.length,
        present: records.filter((r: any) => r.status === 'PRESENT').length,
        absent: records.filter((r: any) => r.status === 'ABSENT').length,
        late: records.filter((r: any) => r.status === 'LATE').length
      };

      pdf.setFontSize(10);
      pdf.text(`Total: ${summary.total} | Present: ${summary.present} | Late: ${summary.late} | Absent: ${summary.absent}`, margin, yPos);
      yPos += 15;

      // Table Headers
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      const colWidths = [50, 60, 40, 30]; // Adjusted widths
      const headers = ['Name', 'Email', 'Check-in Time', 'Status'];
      let xPos = margin;

      headers.forEach((header, index) => {
        pdf.text(header, xPos, yPos);
        xPos += colWidths[index];
      });
      yPos += 8;

      // Draw line under headers
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
      yPos += 5;

      // Table Rows
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);

      records.forEach((record: any, index: number) => {
        const rowData = [
          record.name || 'N/A',
          record.email || 'N/A',
          record.checkInTime || 'N/A',
          record.status || 'ABSENT'
        ];

        // Split all cells and find max lines
        const splitCells = rowData.map((cell, cellIndex) =>
          pdf.splitTextToSize(String(cell), colWidths[cellIndex] - 2),
        );
        const maxLines = Math.max(...splitCells.map(cell => cell.length));
        const lineHeight = 6;

        // Check if we need a new page before drawing this row
        if (yPos + maxLines * lineHeight > pageHeight - 20) {
          pdf.addPage();
          yPos = startY;
        }

        // Draw each cell
        xPos = margin;
        splitCells.forEach((cellText, cellIndex) => {
          const cellYStart = yPos;
          if (Array.isArray(cellText)) {
            cellText.forEach((line, lineIndex) => {
              pdf.text(line, xPos, cellYStart + lineIndex * lineHeight);
            });
          } else {
            pdf.text(cellText, xPos, cellYStart);
          }
          xPos += colWidths[cellIndex];
        });

        // Move yPos down
        yPos += maxLines * lineHeight + 2;

        // Draw line between rows
        if (index < records.length - 1) {
          pdf.setLineWidth(0.1);
          pdf.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
          yPos += 2;
        }
      });

      // Save PDF
      pdf.save(`${sessionName.replace(/[^a-z0-9]/gi, '_')}_Attendance_${date}.pdf`);
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
      setError('Failed to download PDF. Please try again.');
    }
  };

  // Format date/time helper
  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Prepare pie chart data
  const pieData = analyticsData
    ? [
      { name: 'Present', value: analyticsData.summary.present, color: '#22c55e' },
      { name: 'Late', value: analyticsData.summary.late || 0, color: '#eab308' },
      { name: 'Absent', value: analyticsData.summary.absent, color: '#ef4444' },
    ].filter(item => item.value > 0) // Only show categories with values > 0
    : [];

  if (isLoadingFilters) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col">
          <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex flex-1 justify-center">
            <div className="layout-content-container flex flex-col w-full max-w-7xl flex-1">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-8 w-8 text-[#f04129] mb-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                  </svg>
                  <p className="text-[#8a7b60] dark:text-gray-400">Loading classes...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex flex-1 justify-center">
          <div className="layout-content-container flex flex-col w-full max-w-7xl flex-1">
            {/* Page Header */}
            <div className="flex min-w-72 flex-col gap-3 mb-8">
              <p className="text-[#181511] dark:text-white text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em]">
                Attendance Report
              </p>
              <p className="text-[#8a7b60] dark:text-gray-400 text-base font-normal leading-normal">
                View class-wise attendance analytics, statistics, and detailed session logs.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20 p-4 rounded-xl flex items-center">
                <span className="material-symbols-outlined mr-2">error</span>
                {error}
              </div>
            )}

            {/* Filter Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6 sm:p-8 mb-8">
              <h2 className="text-[#181511] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em] mb-5 flex items-center">
                <span className="material-symbols-outlined text-[#f04129] mr-2">filter_alt</span>
                Select Class & Date Range
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <label className="flex flex-col flex-1">
                  <p className="text-[#181511] dark:text-gray-200 text-sm font-medium leading-normal pb-2">Class/Batch</p>
                  <div className="relative">
                    <select
                      className="form-select appearance-none flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-12 p-3 text-base font-normal leading-normal"
                      value={selectedClass}
                      onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setAnalyticsData(null);
                        setSessionLogs([]);
                        setError('');
                      }}
                      disabled={isLoading}
                    >
                      <option value="">-- Select Class --</option>
                      {classes.map((classBatch) => (
                        <option key={classBatch._id} value={classBatch._id}>
                          {classBatch.name}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7b60] dark:text-gray-400">
                      unfold_more
                    </span>
                  </div>
                </label>

                <label className="flex flex-col flex-1">
                  <p className="text-[#181511] dark:text-gray-200 text-sm font-medium leading-normal pb-2">Start Date</p>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setAnalyticsData(null);
                      setSessionLogs([]);
                      setError('');
                    }}
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-12 p-3 text-base font-normal leading-normal"
                    disabled={isLoading}
                  />
                </label>

                <label className="flex flex-col flex-1">
                  <p className="text-[#181511] dark:text-gray-200 text-sm font-medium leading-normal pb-2">End Date</p>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setAnalyticsData(null);
                      setSessionLogs([]);
                      setError('');
                    }}
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary border border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-primary/50 dark:focus:border-primary/50 h-12 p-3 text-base font-normal leading-normal"
                    disabled={isLoading}
                  />
                </label>

                <button
                  className="flex w-full min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-gradient-to-r from-orange-500 to-[#f04129] text-white gap-2 text-base font-bold leading-normal tracking-[0.015em] hover:from-orange-600 hover:to-[#d63a25] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  onClick={handleViewReport}
                  disabled={isLoading || !selectedClass || !startDate || !endDate}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                      </svg>
                      <span className="truncate">Loading...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-white">analytics</span>
                      <span className="truncate">View Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tab Switcher */}
            {(analyticsData || sessionLogs.length > 0) && (
              <div className="mb-6 flex gap-2 border-b border-[#e6e2db] dark:border-slate-700">
                <button
                  onClick={() => {
                    setActiveTab('analytics');
                    if (selectedClass && startDate && endDate) {
                      handleViewReport();
                    }
                  }}
                  className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'analytics'
                    ? 'bg-white dark:bg-slate-800 text-[#f04129] border-b-2 border-[#f04129]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-[#181511] dark:hover:text-white'
                    }`}
                >
                  <span className="material-symbols-outlined align-middle mr-2">analytics</span>
                  Analytics
                </button>
                <button
                  onClick={() => {
                    setActiveTab('logs');
                    if (selectedClass && startDate && endDate) {
                      handleViewReport();
                    }
                  }}
                  className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'logs'
                    ? 'bg-white dark:bg-slate-800 text-[#f04129] border-b-2 border-[#f04129]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-[#181511] dark:hover:text-white'
                    }`}
                >
                  <span className="material-symbols-outlined align-middle mr-2">description</span>
                  Attendance Logs
                </button>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-8 w-8 text-[#f04129] mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                  </svg>
                  <p className="text-[#8a7b60] dark:text-gray-400">Loading {activeTab === 'analytics' ? 'analytics' : 'logs'}...</p>
                </div>
              </div>
            )}

            {/* TAB 1: Analytics View */}
            {!isLoading && activeTab === 'analytics' && analyticsData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Section 1: Trends & Stats (Top Row) */}

                {/* Left: Line Chart - Attendance Trend */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6">
                  <h3 className="text-[#181511] dark:text-white text-lg font-bold mb-4 flex items-center">
                    <span className="material-symbols-outlined text-[#f04129] mr-2">trending_up</span>
                    Attendance Trend
                  </h3>
                  {analyticsData.timeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={256}>
                      <LineChart data={analyticsData.timeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e6e2db" className="dark:stroke-slate-700" />
                        <XAxis
                          dataKey="date"
                          stroke="#8a7b60"
                          className="dark:stroke-gray-400"
                          tick={{ fill: '#8a7b60', className: 'dark:fill-gray-400' }}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          stroke="#8a7b60"
                          className="dark:stroke-gray-400"
                          tick={{ fill: '#8a7b60', className: 'dark:fill-gray-400' }}
                          style={{ fontSize: '12px' }}
                          domain={[0, 100]}
                          label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', fill: '#8a7b60', className: 'dark:fill-gray-400' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e6e2db',
                            borderRadius: '8px',
                            color: '#181511'
                          }}
                          labelStyle={{ color: '#181511' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="percentage"
                          stroke="#f04129"
                          strokeWidth={2}
                          dot={{ fill: '#f04129', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-[#8a7b60] dark:text-gray-400">
                      No data available for the selected date range
                    </div>
                  )}
                </div>

                {/* Right: Pie Chart - Overall Status */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6">
                  <h3 className="text-[#181511] dark:text-white text-lg font-bold mb-4 flex items-center">
                    <span className="material-symbols-outlined text-[#f04129] mr-2">pie_chart</span>
                    Overall Status
                  </h3>
                  {pieData.length > 0 && pieData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={256}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e6e2db',
                            borderRadius: '8px',
                            color: '#181511'
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '14px', color: '#8a7b60' }}
                          className="dark:text-gray-400"
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-[#8a7b60] dark:text-gray-400">
                      No attendance data available
                    </div>
                  )}
                </div>

                {/* Section 2: Leaderboards (Bottom Row) */}

                {/* Left: Top 5 Performers */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6">
                  <h3 className="text-[#181511] dark:text-white text-lg font-bold mb-4 flex items-center">
                    <span className="material-symbols-outlined text-[#f04129] mr-2">emoji_events</span>
                    Top 5 Performers
                  </h3>
                  {analyticsData.topPerformers.length > 0 ? (
                    <div className="space-y-3">
                      {analyticsData.topPerformers.map((performer, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-lg font-bold text-green-700 dark:text-green-400 min-w-[24px]">
                              #{index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#181511] dark:text-white truncate">
                                {performer.name}
                              </p>
                              <p className="text-xs text-[#8a7b60] dark:text-gray-400 truncate">
                                {performer.email}
                              </p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-full text-sm font-semibold whitespace-nowrap">
                            {performer.percentage.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-[#8a7b60] dark:text-gray-400">
                      No performers data available
                    </div>
                  )}
                </div>

                {/* Right: Top 5 Defaulters */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6">
                  <h3 className="text-[#181511] dark:text-white text-lg font-bold mb-4 flex items-center">
                    <span className="material-symbols-outlined text-[#f04129] mr-2">warning</span>
                    Top 5 Defaulters
                  </h3>
                  {analyticsData.defaulters.length > 0 ? (
                    <div className="space-y-3">
                      {analyticsData.defaulters.map((defaulter, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-lg font-bold text-red-700 dark:text-red-400 min-w-[24px]">
                              #{index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#181511] dark:text-white truncate">
                                {defaulter.name}
                              </p>
                              <p className="text-xs text-[#8a7b60] dark:text-gray-400 truncate">
                                {defaulter.email}
                              </p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 rounded-full text-sm font-semibold whitespace-nowrap">
                            {defaulter.percentage.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-[#8a7b60] dark:text-gray-400">
                      No defaulters data available
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Logs View */}
            {!isLoading && activeTab === 'logs' && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[#181511] dark:text-white text-xl font-bold flex items-center">
                    <span className="material-symbols-outlined text-[#f04129] mr-2">description</span>
                    Session Attendance Logs
                  </h2>
                  {/* Force Mark button removed - use "Manage" button in table rows */}
                </div>
                {sessionLogs.length > 0 ? (
                  <>
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full min-w-full divide-y divide-[#e6e2db] dark:divide-slate-700">
                        <thead className="bg-[#f9fafb] dark:bg-slate-900/50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[#8a7b60] dark:text-gray-300 uppercase tracking-wider" scope="col">Date</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[#8a7b60] dark:text-gray-300 uppercase tracking-wider" scope="col">Session Name</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[#8a7b60] dark:text-gray-300 uppercase tracking-wider" scope="col">Attendance</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[#8a7b60] dark:text-gray-300 uppercase tracking-wider" scope="col">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[#8a7b60] dark:text-gray-300 uppercase tracking-wider hidden md:table-cell" scope="col">Late</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[#8a7b60] dark:text-gray-300 uppercase tracking-wider" scope="col">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-[#e6e2db] dark:divide-slate-700">
                          {sessionLogs.map((log) => (
                            <React.Fragment key={`${log._id}_${log.dateStr || log.date}`}>
                              <tr className="hover:bg-red-50 dark:hover:bg-[#f04129]/10 transition-colors duration-150">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#181511] dark:text-white">
                                  {formatDate(log.date)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#181511] dark:text-white">
                                  {log.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#181511] dark:text-white">
                                  <span className="font-semibold">{log.presentCount}</span>
                                  <span className="text-[#8a7b60] dark:text-gray-400">/{log.totalAssigned || log.totalUsers}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${log.status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                                    log.status === 'Cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                                      log.status === 'Today' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm hidden md:table-cell">
                                  {log.lateCount > 0 ? (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">
                                      {log.lateCount}
                                    </span>
                                  ) : (
                                    <span className="text-[#8a7b60] dark:text-gray-400">0</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex justify-end">
                                    <ActionMenu
                                      onManage={() => {
                                        setViewingSessionId(log._id);
                                        setViewingSessionDate(log.date);
                                      }}
                                      onView={() => {
                                        // "View Details" just opens the exact same modal/overlay as per legacy requirement
                                        // or could be used to fetch inline details as before.
                                        // Based on prompt "View Details... Must navigate correctly" vs "Reuse existing...",
                                        // we stick to opening the SessionAttendanceView as that IS the detailed view.
                                        setViewingSessionId(log._id);
                                        setViewingSessionDate(log.date);
                                      }}
                                      onPdf={() => downloadSessionPDF(log._id, log.name, log.dateStr || log.date)}
                                      onCsv={() => downloadSessionCSV(log._id, log.name, log.dateStr || log.date)}
                                    />
                                  </div>
                                </td>
                              </tr>
                              {/* Expanded details removed - use SessionAttendanceView component via "View Details" action */}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards (block sm:hidden) */}
                    <div className="block sm:hidden space-y-4">
                      {sessionLogs.map((log) => (
                        <div key={`mobile_${log._id}_${log.dateStr || log.date}`} className="bg-white dark:bg-slate-800 rounded-lg border border-[#e6e2db] dark:border-slate-700 p-4 shadow-sm">
                          {/* Header */}
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-xs text-[#8a7b60] dark:text-gray-400 mb-1">
                                {formatDate(log.date)}
                              </p>
                              <p className="font-semibold text-[#181511] dark:text-white line-clamp-1">
                                {log.name}
                              </p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold ${log.status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                              log.status === 'Cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                                log.status === 'Today' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                              {log.status}
                            </span>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 text-center mb-4">
                            <div>
                              <p className="text-[10px] text-[#8a7b60] dark:text-gray-400 uppercase tracking-wide">Present</p>
                              <p className="font-semibold text-[#181511] dark:text-white text-sm mt-0.5">{log.presentCount} <span className="text-xs font-normal text-gray-400">/ {log.totalAssigned || log.totalUsers}</span></p>
                            </div>
                            <div>
                              <p className="text-[10px] text-[#8a7b60] dark:text-gray-400 uppercase tracking-wide">Late</p>
                              <p className={`font-semibold text-sm mt-0.5 ${log.lateCount > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-[#181511] dark:text-white"}`}>{log.lateCount}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-[#8a7b60] dark:text-gray-400 uppercase tracking-wide">Rate</p>
                              <p className={`font-semibold text-sm mt-0.5 ${log.attendancePercentage < 50 ? "text-red-600" : "text-green-600"}`}>{log.attendancePercentage}%</p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="mt-4 flex justify-end">
                            <ActionMenu
                              onManage={() => {
                                setViewingSessionId(log._id);
                                setViewingSessionDate(log.date);
                              }}
                              onView={() => {
                                setViewingSessionId(log._id);
                                setViewingSessionDate(log.date);
                              }}
                              onPdf={() => downloadSessionPDF(log._id, log.name, log.dateStr || log.date)}
                              onCsv={() => downloadSessionCSV(log._id, log.name, log.dateStr || log.date)}
                            />
                          </div>

                          {/* Mobile expanded details removed - use SessionAttendanceView via "View Details" */}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-[#8a7b60] dark:text-gray-400 text-base mb-2">No session logs found.</p>
                    <p className="text-[#8a7b60] dark:text-gray-400 text-sm">
                      Select a class and date range, then click "View Report" to see session logs.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Empty State - Initial */}
            {!isLoading && !analyticsData && sessionLogs.length === 0 && !error && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-[#e6e2db] dark:border-slate-700 p-6 sm:p-8 text-center py-12">
                <p className="text-[#181511] dark:text-white text-xl font-semibold mb-2">📊 Ready to View Report</p>
                <p className="text-[#8a7b60] dark:text-gray-400">
                  Select a class and date range above, then click "View Report" to generate analytics or view logs.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Force Mark removed - use "Manage" button in session attendance table rows */}

      {/* Session Attendance View Modal */}
      {
        viewingSessionId && (
          <SessionAttendanceView
            sessionId={viewingSessionId}
            sessionDate={viewingSessionDate || undefined}
            onClose={() => {
              setViewingSessionId(null);
              setViewingSessionDate(null);
              // Optionally refresh the session logs
              if (selectedClass && startDate && endDate && activeTab === 'logs') {
                handleViewReport();
              }
            }}
          />
        )
      }
    </div >
  );
};

export default AttendanceReport;
