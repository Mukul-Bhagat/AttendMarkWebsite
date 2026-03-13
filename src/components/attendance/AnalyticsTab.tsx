import React, { useMemo } from 'react';
import { BarChart, Bar, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { CalendarDays, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';

interface DashboardDay {
    date: string;
    status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'APPROVED_LEAVE' | 'PENDING' | 'ABSENT' | 'NO_SESSION';
    lateMinutes?: number;
    isHalfDay?: boolean;
    symbol?: string | null;
    tags?: string[];
}

interface DashboardData {
    filters: {
        startDate: string;
        endDate: string;
    };
    summary: {
        totalDays: number;
        scheduledDays: number;
        present: number;
        late: number;
        approvedLeave: number;
        absent: number;
        pending: number;
        halfDay: number;
        noSession: number;
    };
    calendarDays: DashboardDay[];
    weeklyBreakdown: Array<{
        label: string;
        present: number;
        late: number;
        approvedLeave: number;
        absent: number;
        pending: number;
        halfDay: number;
    }>;
    pieBreakdown: {
        mode: 'SPLIT_PRESENT_ABSENT' | 'SEPARATE_BUCKET';
        present: { value: number; percentage: number };
        approvedLeave: { value: number; percentage: number };
        absent: { value: number; percentage: number };
        halfDayCount: number;
    };
    timelineLogs: Array<{
        date: string;
        status: DashboardDay['status'];
        scheduledSessions: number;
        markedSessions: number;
        checkInAt?: string | null;
        checkOutAt?: string | null;
        lateMinutes?: number;
        tags: string[];
    }>;
}

interface AnalyticsTabProps {
    analyticsData: DashboardData | null;
    loading: boolean;
}

const STATUS_META: Record<DashboardDay['status'], { label: string; color: string; chip: string }> = {
    PRESENT: { label: 'Present (On Time)', color: '#22c55e', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    LATE: { label: 'Late', color: '#eab308', chip: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    APPROVED_LEAVE: { label: 'Approved Leave', color: '#3b82f6', chip: 'bg-blue-100 text-blue-700 border-blue-200' },
    ABSENT: { label: 'Absent / Unapproved Leave', color: '#ef4444', chip: 'bg-red-100 text-red-700 border-red-200' },
    PENDING: { label: 'Pending', color: '#f97316', chip: 'bg-orange-100 text-orange-700 border-orange-200' },
    NO_SESSION: { label: 'No Session', color: '#9ca3af', chip: 'bg-slate-100 text-slate-700 border-slate-200' },
    HALF_DAY: { label: 'Half Day', color: '#0ea5e9', chip: 'bg-sky-100 text-sky-700 border-sky-200' },
};

const weekdayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateLabel = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const formatTime = (value?: string | null) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ analyticsData, loading }) => {
    const legendStatuses = useMemo(
        () => Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>,
        [],
    );

    const calendarGrid = useMemo<Array<DashboardDay | null>>(() => {
        if (!analyticsData?.calendarDays?.length) return [];
        const ordered = [...analyticsData.calendarDays].sort((a, b) => a.date.localeCompare(b.date));
        const firstDayIndex = new Date(`${ordered[0].date}T00:00:00`).getDay();
        const placeholders: Array<DashboardDay | null> = Array.from({ length: firstDayIndex }, () => null);
        return [...placeholders, ...ordered];
    }, [analyticsData?.calendarDays]);

    const pieData = useMemo(() => {
        if (!analyticsData?.pieBreakdown) return [];
        return [
            {
                name: 'Present',
                value: analyticsData.pieBreakdown.present.value,
                percentage: analyticsData.pieBreakdown.present.percentage,
                color: STATUS_META.PRESENT.color,
            },
            {
                name: 'Approved Leave',
                value: analyticsData.pieBreakdown.approvedLeave.value,
                percentage: analyticsData.pieBreakdown.approvedLeave.percentage,
                color: STATUS_META.APPROVED_LEAVE.color,
            },
            {
                name: 'Absent',
                value: analyticsData.pieBreakdown.absent.value,
                percentage: analyticsData.pieBreakdown.absent.percentage,
                color: STATUS_META.ABSENT.color,
            },
        ].filter((entry) => entry.value > 0);
    }, [analyticsData?.pieBreakdown]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                    <p className="mt-4 text-text-secondary-light dark:text-text-secondary-dark">Loading dashboard analytics...</p>
                </div>
            </div>
        );
    }

    if (!analyticsData) {
        return (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-12 text-center">
                <CalendarDays className="w-16 h-16 text-primary/20 dark:text-primary/10 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">No Analytics Data</h3>
                <p className="text-text-secondary-light dark:text-text-secondary-dark max-w-md mx-auto">
                    Select class and date range, then click View Report.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                <SummaryPill label="Scheduled Days" value={analyticsData.summary.scheduledDays} tone="slate" />
                <SummaryPill label="Present" value={analyticsData.summary.present} tone="green" />
                <SummaryPill label="Late" value={analyticsData.summary.late} tone="yellow" />
                <SummaryPill label="Half Day" value={analyticsData.summary.halfDay} tone="sky" />
                <SummaryPill label="Leave" value={analyticsData.summary.approvedLeave} tone="blue" />
                <SummaryPill label="Absent" value={analyticsData.summary.absent} tone="red" />
                <SummaryPill label="Pending" value={analyticsData.summary.pending} tone="orange" />
                <SummaryPill label="No Session" value={analyticsData.summary.noSession} tone="gray" />
                <SummaryPill label="Total Days" value={analyticsData.summary.totalDays} tone="slate" />
            </div>

            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-lg font-black text-text-primary-light dark:text-text-primary-dark">Attendance Calendar</h3>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Dash marker on date means Half Day</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {legendStatuses.map((status) => (
                            <span key={status} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${STATUS_META[status].chip}`}>
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[status].color }} />
                                {STATUS_META[status].label}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center mb-2">
                    {weekdayHeaders.map((day) => (
                        <div key={day} className="text-[11px] font-black uppercase tracking-wide text-text-secondary-light">{day}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {calendarGrid.map((day, index) => {
                        if (!day) return <div key={`empty-${index}`} className="h-20 rounded-xl border border-dashed border-border-light/60 dark:border-border-dark/60" />;
                        const meta = STATUS_META[day.status];
                        return (
                            <div key={day.date} className="relative h-20 rounded-xl border border-border-light dark:border-border-dark px-2 py-1.5 overflow-hidden group" style={{ backgroundColor: `${meta.color}14` }}>
                                <div className="flex items-start justify-between">
                                    <span className="text-[11px] font-bold text-text-primary-light dark:text-text-primary-dark">{new Date(`${day.date}T00:00:00`).getDate()}</span>
                                    <span className="h-2.5 w-2.5 rounded-full mt-0.5" style={{ backgroundColor: meta.color }} />
                                </div>
                                {day.status === 'LATE' && (
                                    <p className="text-[10px] font-semibold text-yellow-700 mt-2">+{day.lateMinutes || 0}m</p>
                                )}
                                {day.status === 'HALF_DAY' && (
                                    <div className="absolute inset-x-2 top-1/2 border-t-2 border-sky-500" title="Half Day (dash)" />
                                )}
                                <p className="absolute bottom-1.5 left-2 text-[10px] font-semibold text-text-secondary-light">{meta.label.split(' ')[0]}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <div className="xl:col-span-3 bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-black text-text-primary-light dark:text-text-primary-dark">Weekly Breakdown</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analyticsData.weeklyBreakdown}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="present" name="Present" stackId="a" fill={STATUS_META.PRESENT.color} />
                            <Bar dataKey="late" name="Late" stackId="a" fill={STATUS_META.LATE.color} />
                            <Bar dataKey="approvedLeave" name="Leave" stackId="a" fill={STATUS_META.APPROVED_LEAVE.color} />
                            <Bar dataKey="halfDay" name="Half Day" stackId="a" fill={STATUS_META.HALF_DAY.color} />
                            <Bar dataKey="absent" name="Absent" stackId="a" fill={STATUS_META.ABSENT.color} />
                            <Bar dataKey="pending" name="Pending" stackId="a" fill={STATUS_META.PENDING.color} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="xl:col-span-2 bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChartIcon className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-black text-text-primary-light dark:text-text-primary-dark">Pie Analysis</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={86} paddingAngle={3}>
                                {pieData.map((entry) => (
                                    <Cell key={entry.name} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                        {pieData.map((entry) => (
                            <div key={entry.name} className="flex items-center justify-between rounded-xl border border-border-light dark:border-border-dark px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{entry.name}</span>
                                </div>
                                <span className="text-sm font-black text-text-primary-light dark:text-text-primary-dark">{entry.percentage.toFixed(1)}%</span>
                            </div>
                        ))}
                        <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark pt-1">
                            Half Day Mode: <span className="font-bold">{analyticsData.pieBreakdown.mode}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-5 shadow-sm">
                <h3 className="text-lg font-black text-text-primary-light dark:text-text-primary-dark mb-4">Attendance Timeline</h3>
                <div className="space-y-3">
                    {analyticsData.timelineLogs.map((entry) => {
                        const meta = STATUS_META[entry.status];
                        return (
                            <div key={entry.date} className="rounded-xl border border-border-light dark:border-border-dark p-3 bg-background-light/50 dark:bg-background-dark/40">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">{formatDateLabel(entry.date)}</p>
                                        <p className="text-xs text-text-secondary-light">Sessions: {entry.markedSessions}/{entry.scheduledSessions}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${meta.chip}`}>{meta.label}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary-light">
                                    <span>Check-In: {formatTime(entry.checkInAt)}</span>
                                    <span>Check-Out: {formatTime(entry.checkOutAt)}</span>
                                    {entry.lateMinutes ? <span>Late: +{entry.lateMinutes}m</span> : null}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {entry.tags.map((tag) => (
                                        <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark uppercase tracking-wide">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const SummaryPill: React.FC<{ label: string; value: number; tone: 'green' | 'yellow' | 'red' | 'blue' | 'sky' | 'gray' | 'slate' | 'orange' }> = ({ label, value, tone }) => {
    const toneClass: Record<string, string> = {
        green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        red: 'bg-red-100 text-red-700 border-red-200',
        blue: 'bg-blue-100 text-blue-700 border-blue-200',
        sky: 'bg-sky-100 text-sky-700 border-sky-200',
        gray: 'bg-slate-100 text-slate-700 border-slate-200',
        slate: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        orange: 'bg-orange-100 text-orange-700 border-orange-200',
    };

    return (
        <div className={`rounded-xl border px-3 py-2 ${toneClass[tone]}`}>
            <p className="text-[11px] font-black uppercase tracking-wider">{label}</p>
            <p className="text-xl leading-none mt-1 font-black">{value}</p>
        </div>
    );
};

export default AnalyticsTab;
