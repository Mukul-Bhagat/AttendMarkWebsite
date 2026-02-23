import React, { useState, useEffect } from 'react';
import api from '../../../api';
import { IMyAttendanceRecord } from '../../../types';
import { formatIST } from '../../../utils/time';
import { Table, Search, Calendar, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react';

import { appLogger } from '../../../shared/logger';
interface AttendanceReportTabProps {
    userId?: string;
    startDate?: string;
    endDate?: string;
    onDateChange?: (start: string, end: string) => void;
}

const AttendanceReportTab: React.FC<AttendanceReportTabProps> = ({
    userId,
    startDate: initialStartDate = '',
    endDate: initialEndDate = '',
    onDateChange,
}) => {
    const [records, setRecords] = useState<IMyAttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const fetchRecords = async () => {
            try {
                setIsLoading(true);
                const endpoint = userId ? `/api/attendance/user/${userId}` : '/api/attendance/me';
                const { data } = await api.get(endpoint);
                setRecords(data || []);
            } catch (err: any) {
                setError('Failed to load attendance records');
                appLogger.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRecords();
    }, [userId]);

    const filteredRecords = records.filter((record) => {
        const recordDateStr = record.checkInTime ? new Date(record.checkInTime).toISOString().split('T')[0] : '';

        // Date Filter
        if (startDate && recordDateStr < startDate) return false;
        if (endDate && recordDateStr > endDate) return false;

        // Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const sessionName = record.sessionId?.name?.toLowerCase() || '';
            const batchName = record.classBatchId?.name?.toLowerCase() || '';
            if (!sessionName.includes(query) && !batchName.includes(query)) return false;
        }

        return true;
    });

    // Calculate pagination
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const currentRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const formatDateTime = (dateStr: string | Date | undefined) => {
        if (!dateStr) return 'N/A';
        return formatIST(new Date(dateStr).getTime());
    };

    const handleClearFilter = () => {
        setStartDate('');
        setEndDate('');
        setSearchQuery('');
        if (onDateChange) onDateChange('', '');
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-surface-light dark:bg-surface-dark rounded-3xl border border-border-light dark:border-border-dark">
                <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium">Loading historical records...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Error Message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-3xl text-red-600 dark:text-red-400 flex items-center gap-3">
                    <span className="material-symbols-outlined">error</span>
                    <p className="font-bold">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto hover:bg-red-100 dark:hover:bg-red-900/40 p-1 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Filters & Search Header */}
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                            <Table size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-text-primary-light dark:text-text-primary-dark">Attendance Logs</h3>
                            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">Detailed session-by-session history</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary-light" size={18} />
                            <input
                                type="text"
                                placeholder="Search sessions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                            />
                        </div>

                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border transition-all font-bold ${isFilterOpen || startDate || endDate ? 'bg-primary border-primary text-white shadow-lg' : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark'}`}
                        >
                            <Filter size={18} />
                            <span>Filters</span>
                            {(startDate || endDate) && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                        </button>
                    </div>
                </div>

                {/* Expanded Filters */}
                {isFilterOpen && (
                    <div className="mt-6 pt-6 border-t border-border-light dark:border-border-dark animate-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-text-secondary-light uppercase tracking-widest ml-1">From Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary-light" size={16} />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => {
                                            setStartDate(e.target.value);
                                            if (onDateChange) onDateChange(e.target.value, endDate);
                                        }}
                                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-text-secondary-light uppercase tracking-widest ml-1">To Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary-light" size={16} />
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => {
                                            setEndDate(e.target.value);
                                            if (onDateChange) onDateChange(startDate, e.target.value);
                                        }}
                                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleClearFilter}
                                    className="flex items-center gap-2 px-6 py-3 text-text-secondary-light hover:text-red-500 font-bold transition-all"
                                >
                                    <X size={18} />
                                    <span>Clear All</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Table Desktop View */}
            <div className="hidden md:block overflow-hidden bg-surface-light dark:bg-surface-dark rounded-3xl border border-border-light dark:border-border-dark shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-background-light/50 dark:bg-background-dark/50">
                        <tr>
                            <th className="px-6 py-4 text-xs font-black text-text-secondary-light uppercase tracking-widest">Session</th>
                            <th className="px-6 py-4 text-xs font-black text-text-secondary-light uppercase tracking-widest">Date & Time</th>
                            <th className="px-6 py-4 text-xs font-black text-text-secondary-light uppercase tracking-widest">Attendance</th>
                            <th className="px-6 py-4 text-xs font-black text-text-secondary-light uppercase tracking-widest">Remarks</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                        {currentRecords.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-20 text-center text-text-secondary-light font-medium">
                                    No records found matching your filters.
                                </td>
                            </tr>
                        ) : (
                            currentRecords.map((record) => (
                                <tr key={record._id} className="hover:bg-background-light/50 dark:hover:bg-background-dark/30 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="font-bold text-text-primary-light dark:text-text-primary-dark">
                                            {record.classBatchId?.name || (record.sessionId ? record.sessionId.name : 'Session')}
                                        </div>
                                        {record.sessionId?.sessionType && (
                                            <span className="inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-bold bg-background-light dark:bg-background-dark text-text-secondary-light">
                                                {record.sessionId.sessionType}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                                            {formatDateTime(record.checkInTime)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        {record.isLate ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
                                                Late {record.lateByMinutes ? `(${record.lateByMinutes}m)` : ''}
                                            </span>
                                        ) : record.locationVerified ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800">
                                                Verified
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800">
                                                Unverified
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                            {record.deviceId && <div className="font-mono">ID: {record.deviceId.substring(0, 8)}...</div>}
                                            {record.userLocation && (
                                                <div>Lat: {record.userLocation.latitude.toFixed(4)}, Lng: {record.userLocation.longitude.toFixed(4)}</div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-text-secondary-light font-medium font-mono">
                        Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark disabled:opacity-30 hover:bg-background-light dark:hover:bg-background-dark transition-all shadow-sm"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark disabled:opacity-30 hover:bg-background-light dark:hover:bg-background-dark transition-all shadow-sm"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceReportTab;
