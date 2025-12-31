import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { IMyAttendanceRecord } from '../types';

const MyAttendance: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<IMyAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [highlightedSessionId, setHighlightedSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyAttendance = async () => {
      try {
        const { data } = await api.get('/api/attendance/me');
        setRecords(data || []);
      } catch (err: any) {
        if (err.response?.status === 401) {
          setError('You are not authorized. Please log in again.');
        } else {
          setError('Failed to fetch attendance history.');
        }
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyAttendance();
  }, []);

  // Helper to get session ID from record
  const getSessionId = (record: IMyAttendanceRecord): string => {
    if (record.sessionId) {
      // sessionId could be an object with _id or a string
      if (typeof record.sessionId === 'object' && record.sessionId._id) {
        return record.sessionId._id;
      } else if (typeof record.sessionId === 'string') {
        return record.sessionId;
      }
    }
    return record._id; // Fallback to record ID
  };

  // Handle scrollTo query param
  useEffect(() => {
    const scrollToSessionId = searchParams.get('scrollTo');
    if (scrollToSessionId && records.length > 0 && !isLoading) {
      // Wait a bit for DOM to render
      const timer = setTimeout(() => {
        const element = document.getElementById(`session-${scrollToSessionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the card
          setHighlightedSessionId(scrollToSessionId);
          // Remove highlight after 3 seconds
          setTimeout(() => {
            setHighlightedSessionId(null);
          }, 3000);
          // Clean up URL
          searchParams.delete('scrollTo');
          setSearchParams(searchParams, { replace: true });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [records, isLoading, searchParams, setSearchParams]);

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

  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const formatSessionDateTime = (session: any) => {
    if (!session || !session.startDate || !session.startTime) {
      return 'N/A';
    }
    
    try {
      const date = formatDate(session.startDate);
      const time = formatTime(session.startTime);
      return `${date} at ${time}`;
    } catch {
      return 'N/A';
    }
  };

  // Helper function to format date to YYYY-MM-DD for comparison
  const formatDateForComparison = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isFilterOpen && !target.closest('.filter-dropdown-container')) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  if (isLoading) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="material-symbols-outlined text-[#f04129] text-2xl sm:text-3xl md:text-4xl">history</span>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">My Attendance</h1>
              </div>
            </header>
            <div className="flex items-center justify-center py-8 sm:py-12">
              <div className="flex flex-col items-center">
                <svg className="animate-spin h-8 w-8 text-[#f04129] mb-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                </svg>
                <p className="text-sm sm:text-base text-[#8a7b60] dark:text-gray-400">Loading attendance history...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="material-symbols-outlined text-[#f04129] text-2xl sm:text-3xl md:text-4xl">history</span>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">My Attendance</h1>
              </div>
            </header>
            <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 p-3 sm:p-4 rounded-xl flex items-center text-sm sm:text-base">
              <span className="material-symbols-outlined mr-2 flex-shrink-0">error</span>
              <span>{error}</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Filter records based on date range
  const filteredRecords = records.filter((record) => {
    const checkInDate = formatDateForComparison(record.checkInTime);
    
    // If no dates are selected, show all records
    if (!startDate && !endDate) {
      return true;
    }
    
    // If only start date is selected, show records >= start date
    if (startDate && !endDate) {
      return checkInDate >= startDate;
    }
    
    // If only end date is selected, show records <= end date
    if (!startDate && endDate) {
      return checkInDate <= endDate;
    }
    
    // If both dates are selected, show records in range
    if (startDate && endDate) {
      return checkInDate >= startDate && checkInDate <= endDate;
    }
    
    return true;
  });

  // Calculate stats from filtered records
  const totalRecords = filteredRecords.length;
  const verifiedCount = filteredRecords.filter(r => r.locationVerified).length;
  const notVerifiedCount = totalRecords - verifiedCount;

  const handleApplyFilter = () => {
    setIsFilterOpen(false);
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    setIsFilterOpen(false);
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl md:text-4xl">history</span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">My Attendance</h1>
            </div>
          </header>

          {records.length === 0 ? (
            <div className="mt-8 sm:mt-12">
              <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-[#e6e2db] dark:border-slate-800 px-4 sm:px-6 py-10 sm:py-14">
                <div className="flex max-w-[480px] flex-col items-center gap-2 text-center">
                  <span className="material-symbols-outlined text-4xl sm:text-6xl text-[#8a7b60] dark:text-gray-400 mb-2">event_available</span>
                  <p className="text-[#181511] dark:text-white text-base sm:text-lg font-bold leading-tight tracking-[-0.015em]">No Attendance Records</p>
                  <p className="text-[#181511] dark:text-slate-300 text-xs sm:text-sm font-normal leading-normal">
                    You have no attendance records yet. Scan a QR code to mark your attendance for a session.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 sm:p-4 md:p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-[#8a7b60] dark:text-gray-400 mb-1">Total Records</p>
                      <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{totalRecords}</p>
                    </div>
                    <span className="material-symbols-outlined w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 text-[#f04129] opacity-50">event_note</span>
                  </div>
                </div>
                <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 md:p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-400 mb-1">Verified</p>
                      <p className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-400">{verifiedCount}</p>
                    </div>
                    <span className="material-symbols-outlined w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 text-green-600 dark:text-green-400 opacity-50">verified</span>
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 sm:p-4 md:p-6 shadow-sm sm:col-span-2 md:col-span-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-400 mb-1">Not Verified</p>
                      <p className="text-2xl sm:text-3xl font-bold text-red-700 dark:text-red-400">{notVerifiedCount}</p>
                    </div>
                    <span className="material-symbols-outlined w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 text-red-600 dark:text-red-400 opacity-50">cancel</span>
                  </div>
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="mb-4 sm:mb-6 flex justify-end">
                <div className="relative filter-dropdown-container">
                  <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:text-[#f04129] transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">filter_list</span>
                    <span>Filter</span>
                    {(startDate || endDate) && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#f04129] text-white text-xs font-semibold">
                        {(startDate && endDate) ? '2' : '1'}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Menu */}
                  {isFilterOpen && (
                    <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 p-4">
                      <div className="space-y-4">
                        {/* From Date */}
                        <div>
                          <label htmlFor="start-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            From Date
                          </label>
                          <input
                            type="date"
                            id="start-date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#f04129] focus:border-[#f04129] transition-colors"
                          />
                        </div>

                        {/* To Date */}
                        <div>
                          <label htmlFor="end-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            To Date
                          </label>
                          <input
                            type="date"
                            id="end-date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate || undefined}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#f04129] focus:border-[#f04129] transition-colors"
                          />
                        </div>

                        {/* Buttons Row */}
                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <button
                            onClick={handleClearFilter}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                          >
                            Clear
                          </button>
                          <button
                            onClick={handleApplyFilter}
                            className="px-4 py-2 text-sm font-medium text-white bg-[#f04129] rounded-lg hover:bg-[#d63a25] transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" scope="col">Session</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" scope="col">Session Start</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" scope="col">Check-in Time</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" scope="col">Location Status</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" scope="col">Details</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900/50 divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <span className="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-500">event_busy</span>
                              <p className="text-slate-500 dark:text-slate-400 font-medium">No attendance records found for the selected date range</p>
                              {(startDate || endDate) && (
                                <button
                                  onClick={handleClearFilter}
                                  className="text-sm text-[#f04129] hover:underline mt-2"
                                >
                                  Clear filter to show all records
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((record) => (
                        <tr 
                          key={record._id} 
                          id={`session-${getSessionId(record)}`}
                          className={`hover:bg-red-50 dark:hover:bg-[#f04129]/10 transition-colors ${
                            highlightedSessionId === getSessionId(record)
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 ring-2 ring-yellow-400 dark:ring-yellow-600' 
                              : ''
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            {record.sessionId ? (
                              <div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {record.sessionId.name}
                                </div>
                                {record.sessionId.description && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                                    {record.sessionId.description}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {record.sessionId.locationType || record.sessionId.sessionType}
                                  </span>
                                  {record.sessionId.frequency && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#f04129]/10 text-[#f04129]">
                                      {record.sessionId.frequency}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-slate-400 dark:text-slate-500 italic">
                                Session (deleted)
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                            {record.sessionId ? (
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg text-slate-400">schedule</span>
                                {formatSessionDateTime(record.sessionId)}
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-lg text-slate-400">login</span>
                              {formatDateTime(record.checkInTime)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {record.isLate ? (
                              <span 
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800"
                                title={record.lateByMinutes 
                                  ? `Late by ${record.lateByMinutes} ${record.lateByMinutes === 1 ? 'minute' : 'minutes'} - Marked at ${formatDateTime(record.checkInTime)}`
                                  : `Marked Late at ${formatDateTime(record.checkInTime)}`}
                              >
                                <span className="material-symbols-outlined mr-1 text-sm">schedule</span>
                                Late{record.lateByMinutes ? ` (${record.lateByMinutes}m)` : ''}
                              </span>
                            ) : record.locationVerified ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800">
                                <span className="material-symbols-outlined mr-1 text-sm">verified</span>
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800">
                                <span className="material-symbols-outlined mr-1 text-sm">cancel</span>
                                Not Verified
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                            <div className="flex flex-col gap-1">
                              {record.userLocation && (
                                <div className="flex items-center gap-1 text-xs">
                                  <span className="material-symbols-outlined text-sm">location_on</span>
                                  <span>Lat: {record.userLocation.latitude.toFixed(4)}, Lng: {record.userLocation.longitude.toFixed(4)}</span>
                                </div>
                              )}
                              {record.deviceId && (
                                <div className="flex items-center gap-1 text-xs">
                                  <span className="material-symbols-outlined text-sm">phone_android</span>
                                  <span className="font-mono">{record.deviceId.substring(0, 8)}...</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filteredRecords.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-8 shadow-sm">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <span className="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-500">event_busy</span>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">No attendance records found for the selected date range</p>
                      {(startDate || endDate) && (
                        <button
                          onClick={handleClearFilter}
                          className="text-sm text-[#f04129] hover:underline mt-1"
                        >
                          Clear filter to show all records
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  filteredRecords.map((record) => (
                  <div
                    key={record._id}
                    id={`session-${getSessionId(record)}`}
                    className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 shadow-sm transition-all ${
                      highlightedSessionId === getSessionId(record)
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 ring-2 ring-yellow-400 dark:ring-yellow-600' 
                        : ''
                    }`}
                  >
                    {/* Header with Session Name and Verified Badge */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                          {record.sessionId ? record.sessionId.name : 'Session (deleted)'}
                        </h3>
                        {record.sessionId?.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                            {record.sessionId.description}
                          </p>
                        )}
                      </div>
                      <div className="ml-2 flex-shrink-0">
                        {record.isLate ? (
                          <span 
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800"
                            title={record.lateByMinutes 
                              ? `Late by ${record.lateByMinutes} ${record.lateByMinutes === 1 ? 'minute' : 'minutes'} - Marked at ${formatDateTime(record.checkInTime)}`
                              : `Marked Late at ${formatDateTime(record.checkInTime)}`}
                          >
                            <span className="material-symbols-outlined mr-1 text-sm">schedule</span>
                            Late{record.lateByMinutes ? ` (${record.lateByMinutes}m)` : ''}
                          </span>
                        ) : record.locationVerified ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800">
                            <span className="material-symbols-outlined mr-1 text-sm">verified</span>
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800">
                            <span className="material-symbols-outlined mr-1 text-sm">cancel</span>
                            Not Verified
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details Stack */}
                    <div className="space-y-2">
                      {/* Session Start */}
                      {record.sessionId && (
                        <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <span className="material-symbols-outlined text-lg text-slate-400 flex-shrink-0 mt-0.5">schedule</span>
                          <div>
                            <span className="font-medium">Start: </span>
                            <span>{formatSessionDateTime(record.sessionId)}</span>
                          </div>
                        </div>
                      )}

                      {/* Check-in Time */}
                      <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <span className="material-symbols-outlined text-lg text-slate-400 flex-shrink-0 mt-0.5">login</span>
                        <div>
                          <span className="font-medium">Check-in: </span>
                          <span>{formatDateTime(record.checkInTime)}</span>
                        </div>
                      </div>

                      {/* Location */}
                      {record.userLocation && (
                        <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <span className="material-symbols-outlined text-lg text-slate-400 flex-shrink-0 mt-0.5">location_on</span>
                          <div>
                            <span className="font-medium">Location: </span>
                            <span className="text-xs">Lat: {record.userLocation.latitude.toFixed(4)}, Lng: {record.userLocation.longitude.toFixed(4)}</span>
                          </div>
                        </div>
                      )}

                      {/* Device ID */}
                      {record.deviceId && (
                        <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <span className="material-symbols-outlined text-lg text-slate-400 flex-shrink-0 mt-0.5">phone_android</span>
                          <div>
                            <span className="font-medium">Device: </span>
                            <span className="text-xs font-mono">{record.deviceId.substring(0, 8)}...</span>
                          </div>
                        </div>
                      )}

                      {/* Session Type and Frequency Badges */}
                      {record.sessionId && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {record.sessionId.locationType || record.sessionId.sessionType}
                          </span>
                          {record.sessionId.frequency && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#f04129]/10 text-[#f04129]">
                              {record.sessionId.frequency}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default MyAttendance;

