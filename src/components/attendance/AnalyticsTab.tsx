import React from 'react';
import AttendanceTrendChart from '../charts/AttendanceTrendChart';
import OverallStatusDonut from '../charts/OverallStatusDonut';
import { BarChart3 } from 'lucide-react';

interface AnalyticsTabProps {
    analyticsData: {
        summary: {
            totalRecords: number;
            present: number;
            absent: number;
            late: number;
            leave: number;
            noSession: number;
            presentPercentage: number;
            absentPercentage: number;
            latePercentage: number;
            leavePercentage: number;
            noSessionPercentage: number;
        };
        trend: Array<{
            date: string;
            percentage: number;
            status: string;
            isLate: boolean;
            sessionsCount: number;
        }>;
    } | null;
    loading: boolean;
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ analyticsData, loading }) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="mt-4 text-text-secondary-light dark:text-text-secondary-dark">Loading analytics...</p>
                </div>
            </div>
        );
    }

    // ✅ DERIVE SUMMARY FROM TREND DATA (Synchronize with Bar Graph)
    // Matches logic in AttendanceTrendChart.tsx: Exclude Sundays and NO_SESSION
    const derivedSummary = React.useMemo(() => {
        if (!analyticsData?.trend) return null;

        let present = 0;
        let absent = 0;
        let late = 0;
        let leave = 0;

        analyticsData.trend.forEach((point) => {
            const date = new Date(point.date);
            // Ignore Sundays and NO_SESSION days to match the bar graph view
            if (date.getDay() === 0 || point.status === 'NO_SESSION') return;

            if (point.isLate) {
                late++;
            } else if (point.status === 'PRESENT') {
                present++;
            } else if (point.status === 'LEAVE' || point.status === 'ON_LEAVE') {
                leave++;
            } else {
                absent++;
            }
        });

        const totalRecords = present + absent + late + leave;

        return {
            totalRecords,
            present,
            absent,
            late,
            leave,
            noSession: 0,
            // Bucket percentages (Percentage of Total Working Days)
            presentPercentage: totalRecords > 0 ? (present / totalRecords) * 100 : 0,
            absentPercentage: totalRecords > 0 ? (absent / totalRecords) * 100 : 0,
            latePercentage: totalRecords > 0 ? (late / totalRecords) * 100 : 0,
            leavePercentage: totalRecords > 0 ? (leave / totalRecords) * 100 : 0,
            // Overall Attendance Rate (Present + Late)
            overallRate: totalRecords > 0 ? ((present + late) / totalRecords) * 100 : 0
        };
    }, [analyticsData?.trend]);

    if (!analyticsData || !derivedSummary) {
        return (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-12 text-center">
                <BarChart3 className="w-16 h-16 text-primary/20 dark:text-primary/10 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">No Analytics Data</h3>
                <p className="text-text-secondary-light dark:text-text-secondary-dark max-w-md mx-auto">
                    Select a class and date range above, then click "View Report" to see your attendance analytics.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Chart - Left Side (Bar Graph) */}
                <AttendanceTrendChart data={analyticsData.trend} />

                {/* Donut Chart - Right Side (Uses derived summary for perfect match) */}
                <OverallStatusDonut summary={derivedSummary as any} />
            </div>

            {/* Summary Info */}
            {derivedSummary.totalRecords > 0 && (
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-6 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                        <BarChart3 className="w-6 h-6 text-primary" />
                        <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">Performance Summary</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-background-light dark:bg-background-dark rounded-xl p-4 text-center border border-border-light dark:border-border-dark shadow-sm">
                            <p className="text-text-secondary-light dark:text-text-secondary-dark text-xs uppercase tracking-widest font-black mb-1">Attendance Rate</p>
                            <p className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark">{derivedSummary.overallRate.toFixed(1)}%</p>
                        </div>
                        <div className="bg-background-light dark:bg-background-dark rounded-xl p-4 text-center border border-border-light dark:border-border-dark shadow-sm">
                            <p className="text-text-secondary-light dark:text-text-secondary-dark text-xs uppercase tracking-widest font-black mb-1">Working Days</p>
                            <p className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark">{derivedSummary.totalRecords}</p>
                        </div>
                        <div className="bg-background-light dark:bg-background-dark rounded-xl p-4 text-center border border-border-light dark:border-border-dark shadow-sm">
                            <p className="text-text-secondary-light dark:text-text-secondary-dark text-xs uppercase tracking-widest font-black mb-1">Present Days</p>
                            <p className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark">{derivedSummary.present + derivedSummary.late}</p>
                        </div>
                        <div className="bg-background-light dark:bg-background-dark rounded-xl p-4 text-center border border-border-light dark:border-border-dark shadow-sm">
                            <p className="text-text-secondary-light dark:text-text-secondary-dark text-xs uppercase tracking-widest font-black mb-1">Absent Days</p>
                            <p className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark">{derivedSummary.absent}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsTab;
