import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Target } from 'lucide-react';

interface OverallStatusDonutProps {
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
}

const OverallStatusDonut: React.FC<OverallStatusDonutProps> = ({ summary }) => {
    // Only include actual attendance categories in the Donut to avoid "grey charts"
    const chartData = [
        { name: 'Present', value: summary.present, percentage: summary.presentPercentage, color: '#22c55e' },
        { name: 'Absent', value: summary.absent, percentage: summary.absentPercentage, color: '#ef4444' },
        { name: 'Late', value: summary.late, percentage: summary.latePercentage, color: '#eab308' },
        { name: 'Leave', value: summary.leave, percentage: summary.leavePercentage, color: '#3b82f6' },
    ].filter(item => item.value > 0);

    // Custom label
    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
        if (percentage < 8) return null;

        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor="middle"
                dominantBaseline="central"
                className="font-bold text-[10px]"
            >
                {`${percentage.toFixed(0)}%`}
            </text>
        );
    };

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            return (
                <div className="bg-surface-light dark:bg-surface-dark p-3 rounded-lg shadow-lg border border-border-light dark:border-border-dark">
                    <p className="font-semibold mb-1" style={{ color: data.payload.color }}>
                        {data.name}
                    </p>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">
                        Days: <span className="font-bold text-text-primary-light dark:text-text-primary-dark">{data.value}</span>
                    </p>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">
                        Percentage: <span className="font-bold text-text-primary-light dark:text-text-primary-dark">{data.payload.percentage.toFixed(1)}%</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-6">
            <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">Working Days Analysis</h3>
            </div>

            {summary.totalRecords === 0 ? (
                <div className="h-80 flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark">
                    <p>No data available</p>
                </div>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={renderCustomLabel}
                                outerRadius={100}
                                innerRadius={60}
                                fill="#8884d8"
                                dataKey="value"
                                animationBegin={0}
                                animationDuration={800}
                                stroke="none"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>

                    {/* Stats Summary Grid - Focusing on Working Days */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 p-3 rounded-lg flex flex-col items-center justify-center">
                            <span className="text-green-600 dark:text-green-400 font-bold text-lg">{summary.presentPercentage.toFixed(1)}%</span>
                            <span className="text-green-700 dark:text-green-300 text-[10px] font-medium uppercase tracking-wider text-center">Present Rate</span>
                            <span className="text-green-600 dark:text-green-500 text-[10px]">{summary.present} / {summary.totalRecords} Days</span>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3 rounded-lg flex flex-col items-center justify-center">
                            <span className="text-red-600 dark:text-red-400 font-bold text-lg">{summary.absentPercentage.toFixed(1)}%</span>
                            <span className="text-red-700 dark:text-red-300 text-[10px] font-medium uppercase tracking-wider text-center">Absent Rate</span>
                            <span className="text-red-600 dark:text-red-500 text-[10px]">{summary.absent} / {summary.totalRecords} Days</span>
                        </div>
                    </div>

                    <div className="mt-4 text-center py-2 bg-background-light dark:bg-background-dark/30 rounded-lg border border-border-light dark:border-border-dark">
                        <p className="text-text-secondary-light dark:text-text-secondary-dark text-[10px] font-black uppercase tracking-wider">Total Working Days (Excl. Sundays)</p>
                        <p className="text-text-primary-light dark:text-text-primary-dark font-black text-lg">{summary.totalRecords}</p>
                    </div>
                </>
            )}
        </div>
    );
};

export default OverallStatusDonut;
