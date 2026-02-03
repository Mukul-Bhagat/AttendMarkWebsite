import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface AnalyticsFiltersProps {
    sessions: any[];
    selectedSession: string;
    startDate: string;
    endDate: string;
    onSessionChange: (sessionId: string) => void;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    onViewReport: () => void;
    loading: boolean;
}

const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
    sessions,
    selectedSession,
    startDate,
    endDate,
    onSessionChange,
    onStartDateChange,
    onEndDateChange,
    onViewReport,
    loading,
}) => {
    return (
        <div className="bg-surface-light dark:bg-surface-dark shadow-sm border border-border-light dark:border-border-dark rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">Select Class & Date Range</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Class/Batch Dropdown */}
                <div>
                    <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
                        Class/Batch
                    </label>
                    <div className="relative">
                        <select
                            value={selectedSession}
                            onChange={(e) => onSessionChange(e.target.value)}
                            className="w-full px-4 py-2.5 pr-10 border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark"
                        >
                            <option value="">All Sessions</option>
                            {Array.isArray(sessions) && sessions.map((session) => (
                                <option key={session._id} value={session._id}>
                                    {session.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-3.5 w-5 h-5 text-text-secondary-light pointer-events-none" />
                    </div>
                </div>

                {/* Start Date */}
                <div>
                    <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
                        Start Date
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        max={endDate || undefined}
                        className="w-full px-4 py-2.5 border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark"
                    />
                </div>

                {/* End Date */}
                <div>
                    <label className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
                        End Date
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        min={startDate || undefined}
                        className="w-full px-4 py-2.5 border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark"
                    />
                </div>

                {/* View Report Button */}
                <div className="flex items-end">
                    <button
                        onClick={onViewReport}
                        disabled={!startDate || !endDate || loading}
                        className="w-full bg-primary hover:bg-primary-hover disabled:bg-border-light dark:disabled:bg-border-dark disabled:text-text-secondary-light dark:disabled:text-text-secondary-dark disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Calendar className="w-5 h-5" />
                        {loading ? 'Loading...' : 'View Report'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsFilters;
