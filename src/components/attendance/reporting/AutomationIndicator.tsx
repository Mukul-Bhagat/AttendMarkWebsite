import React from 'react';
import { Calendar, Clock, Mail, MailCheck, Power, Edit2, Trash2 } from 'lucide-react';


interface EmailAutomationConfig {
    _id: string;
    recipientName: string;
    recipientEmail: string;
    internName: string;
    frequency: 'weekly' | 'monthly';
    scheduleTiming: string;
    preferredWeekday?: string;
    preferredTime: string;
    isEnabled: boolean;
    lastEmailSentAt?: string;
}

interface AutomationIndicatorProps {
    configs: EmailAutomationConfig[];
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: () => void;
}

export const AutomationIndicator: React.FC<AutomationIndicatorProps> = ({
    configs,
    onToggle,
    onDelete,
    onEdit
}) => {
    if (configs.length === 0) return null;

    // Group configs by schedule (frequency + time + weekday/timing)
    const groupedConfigs: { [key: string]: EmailAutomationConfig[] } = {};

    configs.forEach(config => {
        const key = `${config.frequency}-${config.preferredTime}-${config.preferredWeekday || config.scheduleTiming}`;
        if (!groupedConfigs[key]) {
            groupedConfigs[key] = [];
        }
        groupedConfigs[key].push(config);
    });

    const formatSchedule = (config: EmailAutomationConfig) => {
        if (config.frequency === 'weekly') {
            return `Every ${config.preferredWeekday} at ${config.preferredTime}`;
        } else {
            const timing = config.scheduleTiming === 'start_of_month' ? 'Start' : 'End';
            return `${timing} of month at ${config.preferredTime}`;
        }
    };

    const formatLastSent = (dateStr?: string) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    return (
        <div className="space-y-4">
            {Object.values(groupedConfigs).map((group) => {
                const primaryConfig = group[0];
                const isGroupActive = group.some(c => c.isEnabled);

                // If any in group is active, we treat group as active for UI
                // But toggle will toggle specific ones

                return (
                    <div
                        key={primaryConfig._id}
                        className="relative bg-[#1e2a3a] border border-[#2d3d52] rounded-xl overflow-hidden"
                    >
                        {/* Top border indicator */}
                        {isGroupActive && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500" />
                        )}

                        <div className="p-5">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-lg ${isGroupActive ? 'bg-emerald-500/10' : 'bg-gray-500/10'}`}>
                                        {isGroupActive ? (
                                            <MailCheck className="w-5 h-5 text-emerald-400" />
                                        ) : (
                                            <Mail className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold text-sm">
                                            Automated Email Reporting
                                        </h3>
                                        <p className="text-gray-400 text-xs mt-0.5">
                                            {isGroupActive ? 'Active & Running' : 'Paused'}
                                        </p>
                                    </div>
                                </div>

                                <span
                                    className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${isGroupActive
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-gray-500/20 text-gray-400'
                                        }`}
                                >
                                    {isGroupActive ? 'ON' : 'OFF'}
                                </span>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                {/* Schedule */}
                                <div className="bg-[#263446] rounded-lg p-3 border border-[#2d3d52]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Calendar className="w-4 h-4 text-blue-400" />
                                        <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                                            Schedule
                                        </span>
                                    </div>
                                    <p className="text-white text-sm font-medium">
                                        {formatSchedule(primaryConfig)}
                                    </p>
                                </div>

                                {/* Last Sent */}
                                <div className="bg-[#263446] rounded-lg p-3 border border-[#2d3d52]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-4 h-4 text-purple-400" />
                                        <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                                            Last Sent
                                        </span>
                                    </div>
                                    <p className="text-white text-sm font-medium">
                                        {formatLastSent(primaryConfig.lastEmailSentAt)}
                                    </p>
                                </div>
                            </div>

                            {/* Recipients List */}
                            <div className="bg-[#263446] rounded-lg p-3 border border-[#2d3d52] mb-4">
                                <span className="text-gray-400 text-xs font-medium uppercase tracking-wide block mb-2">
                                    Sending To ({group.length})
                                </span>
                                <div className="space-y-3">
                                    {group.map((cfg, idx) => (
                                        <div key={cfg._id} className={`flex justify-between items-start ${idx !== group.length - 1 ? 'border-b border-gray-700 pb-2' : ''}`}>
                                            <div>
                                                <p className="text-white text-sm font-medium">
                                                    {cfg.recipientName}
                                                </p>
                                                <p className="text-gray-400 text-xs text-[10px]">
                                                    {cfg.recipientEmail}
                                                </p>
                                            </div>
                                            {/* Individual controls for this recipient */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => onToggle(cfg._id)}
                                                    className={`text-[10px] px-2 py-1 rounded font-bold uppercase transition-colors ${cfg.isEnabled ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                                                        }`}
                                                >
                                                    {cfg.isEnabled ? 'ACTIVE' : 'PAUSED'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(`Delete automation for ${cfg.recipientName}?`)) {
                                                            onDelete(cfg._id);
                                                        }
                                                    }}
                                                    className="text-gray-400 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Group Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => group.forEach(c => onToggle(c._id))}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${isGroupActive
                                        ? 'bg-yellow-500/90 hover:bg-yellow-500 text-white'
                                        : 'bg-emerald-500/90 hover:bg-emerald-500 text-white'
                                        }`}
                                >
                                    <Power className="w-4 h-4" />
                                    {isGroupActive ? 'PAUSE ALL' : 'RESUME ALL'}
                                </button>

                                <button
                                    onClick={onEdit}
                                    className="px-4 py-2.5 bg-blue-500/90 hover:bg-blue-500 text-white rounded-lg transition-all"
                                    title="Edit Schedule (Applies to new setup)"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => {
                                        if (window.confirm('Delete ALL automations in this group?')) {
                                            group.forEach(c => onDelete(c._id));
                                        }
                                    }}
                                    className="px-4 py-2.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-all"
                                    title="Delete All"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
