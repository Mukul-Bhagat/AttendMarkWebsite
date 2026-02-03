import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, getWeek } from 'date-fns';

interface TrendDataPoint {
    date: string;
    percentage: number;
    status: string;
    isLate: boolean;
    sessionsCount: number;
}

interface AttendanceTrendChartProps {
    data: TrendDataPoint[];
}

const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({ data }) => {
    // Process daily data into weekly data for the Bar Chart
    const weeklyData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const weekMap: Record<string, {
            name: string;
            present: number;
            absent: number;
            late: number;
            leave: number;
            startDate: Date;
        }> = {};

        data.forEach((point) => {
            const date = new Date(point.date);

            // Exclude Sundays entirely as per "Remove Sunday" request
            if (date.getDay() === 0 || point.status === 'NO_SESSION') return;

            const weekStr = `Week ${getWeek(date, { weekStartsOn: 1 })}`;

            if (!weekMap[weekStr]) {
                weekMap[weekStr] = {
                    name: weekStr,
                    present: 0,
                    absent: 0,
                    late: 0,
                    leave: 0,
                    startDate: startOfWeek(date, { weekStartsOn: 1 }) // Monday as start
                };
            }

            // Determine status and increment counters
            if (point.isLate) {
                weekMap[weekStr].late++;
            } else if (point.status === 'PRESENT') {
                weekMap[weekStr].present++;
            } else if (point.status === 'LEAVE' || point.status === 'ON_LEAVE') {
                weekMap[weekStr].leave++;
            } else {
                weekMap[weekStr].absent++;
            }
        });

        // Convert map to sorted array
        return Object.values(weekMap)
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
            .map(week => ({
                ...week,
                range: `${format(week.startDate, 'MMM d')} - ${format(endOfWeek(week.startDate, { weekStartsOn: 1 }), 'MMM d')}`
            }));
    }, [data]);

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-surface-light dark:bg-surface-dark p-3 rounded-lg shadow-lg border border-border-light dark:border-border-dark">
                    <p className="font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">{label}</p>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mb-2">{data.range}</p>
                    <div className="space-y-1">
                        <p className="text-xs flex justify-between gap-4">
                            <span className="text-green-600 dark:text-green-400 font-medium">Present:</span>
                            <span className="font-bold text-text-primary-light dark:text-text-primary-dark">{data.present} days</span>
                        </p>
                        <p className="text-xs flex justify-between gap-4">
                            <span className="text-yellow-600 dark:text-yellow-400 font-medium">Late:</span>
                            <span className="font-bold text-text-primary-light dark:text-text-primary-dark">{data.late} days</span>
                        </p>
                        <p className="text-xs flex justify-between gap-4">
                            <span className="text-blue-600 dark:text-blue-400 font-medium">Leave:</span>
                            <span className="font-bold text-text-primary-light dark:text-text-primary-dark">{data.leave} days</span>
                        </p>
                        <p className="text-xs flex justify-between gap-4">
                            <span className="text-red-600 dark:text-red-400 font-medium">Absent:</span>
                            <span className="font-bold text-text-primary-light dark:text-text-primary-dark">{data.absent} days</span>
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-6">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">Weekly Attendance Breakdown</h3>
            </div>

            {data.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark">
                    <p>No data available for the selected period</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                        data={weeklyData}
                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccc" strokeOpacity={0.2} />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#94a3b8' }}
                        />
                        <YAxis
                            domain={[0, 6]}
                            ticks={[0, 1, 2, 3, 4, 5, 6]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#94a3b8' }}
                            label={{ value: 'Days', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#94a3b8' } }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.1 }} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />

                        <Bar dataKey="present" name="Present" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} barSize={40} />
                        <Bar dataKey="late" name="Late" stackId="a" fill="#eab308" radius={[0, 0, 0, 0]} barSize={40} />
                        <Bar dataKey="leave" name="Leave" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={40} />
                        <Bar dataKey="absent" name="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default AttendanceTrendChart;
