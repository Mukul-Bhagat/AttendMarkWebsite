import React, { useState, useEffect } from 'react';
import { Check, X, Mail, Calendar, Clock, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { getReportShareRequests, approveReportShareRequest, rejectReportShareRequest, deleteReportShareRequest, clearReportShareRequestsHistory, ReportShareRequest, downloadAttendanceReport } from '../../../api/reportingApi';
import toast from 'react-hot-toast';
import { formatIST } from '../../../utils/time';

import { appLogger } from '../../../shared/logger';
const ReportApprovalPanel: React.FC = () => {
    const [requests, setRequests] = useState<ReportShareRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const fetchRequests = async () => {
        appLogger.info('[ReportApprovalPanel] Fetching share requests...');
        try {
            setIsLoading(true);
            const response = await getReportShareRequests();
            appLogger.info('[ReportApprovalPanel] API response:', response);
            appLogger.info('[ReportApprovalPanel] Response.data:', response.data);
            appLogger.info('[ReportApprovalPanel] Requests array:', response.data?.data);

            const requestsArray = response.data?.data || [];
            appLogger.info('[ReportApprovalPanel] Total requests:', requestsArray.length);
            appLogger.info('[ReportApprovalPanel] Pending requests:', requestsArray.filter((r: any) => r.status === 'PENDING').length);

            setRequests(requestsArray);
        } catch (err: any) {
            appLogger.error('[ReportApprovalPanel] Failed to fetch requests:', err);
            appLogger.error('[ReportApprovalPanel] Error response:', err.response?.data);
            toast.error('Failed to load pending requests');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (id: string) => {
        try {
            setIsProcessing(id);
            const toastId = toast.loading('Approving and sending report...');
            await approveReportShareRequest(id);
            toast.success('Report approved and sent!', { id: toastId });
            fetchRequests();
        } catch (err: any) {
            toast.error('Approval failed');
            appLogger.error(err);
        } finally {
            setIsProcessing(null);
        }
    };

    const handleReject = async (id: string) => {
        const note = window.prompt('Optional: Reason for rejection?');
        if (note === null) return; // User cancelled

        try {
            setIsProcessing(id);
            const toastId = toast.loading('Rejecting request...');
            await rejectReportShareRequest(id, note);
            toast.success('Report share request rejected', { id: toastId });
            fetchRequests();
        } catch (err: any) {
            toast.error('Rejection failed');
            appLogger.error(err);
        } finally {
            setIsProcessing(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to permanently delete this request? This action cannot be undone.')) {
            return;
        }

        try {
            setIsProcessing(id);
            const toastId = toast.loading('Deleting request...');
            await deleteReportShareRequest(id);
            toast.success('Request deleted successfully', { id: toastId });
            fetchRequests();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete request');
            appLogger.error(err);
        } finally {
            setIsProcessing(null);
        }
    };

    const handleClearHistory = async () => {
        if (!window.confirm('Are you sure you want to clear ALL processed records? This will delete all approved and rejected request history. This action cannot be undone.')) {
            return;
        }

        try {
            setIsProcessing('CLEAR_ALL');
            const toastId = toast.loading('Clearing history...');
            const response = await clearReportShareRequestsHistory();
            toast.success(response.data?.message || 'History cleared successfully', { id: toastId });
            fetchRequests();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to clear history');
            appLogger.error(err);
        } finally {
            setIsProcessing(null);
        }
    };

    const handlePreview = async (request: ReportShareRequest) => {
        try {
            const toastId = toast.loading('Generating preview...');
            const response = await downloadAttendanceReport({
                startDate: request.startDate,
                endDate: request.endDate,
                userId: request.targetUserId._id,
                organizationName: request.organizationName,
                organizationLogo: request.organizationLogo,
                format: 'pdf',
                reportType: 'ALL'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            toast.dismiss(toastId);
        } catch (err: any) {
            toast.error('Failed to generate preview');
            appLogger.error(err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <RefreshCw size={40} className="text-primary animate-spin mb-4" />
                <p className="text-text-secondary-light dark:text-text-secondary-dark font-bold">Loading share requests...</p>
            </div>
        );
    }

    const pendingRequests = requests.filter(r => r.status === 'PENDING');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black text-text-primary-light dark:text-text-primary-dark">Report Approval Queue</h3>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">Review and approve attendance reports waiting to be shared</p>
                </div>
                <button
                    onClick={fetchRequests}
                    className="p-2 hover:bg-background-light dark:hover:bg-background-dark rounded-xl transition-all"
                >
                    <RefreshCw size={20} className="text-text-secondary-light" />
                </button>
            </div>

            {pendingRequests.length === 0 ? (
                <div className="bg-surface-light dark:bg-surface-dark p-12 rounded-3xl border border-dashed border-border-light dark:border-border-dark text-center">
                    <div className="inline-flex p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400 mb-4">
                        <Check size={32} />
                    </div>
                    <h4 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-1">Queue is Clear!</h4>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark max-w-sm mx-auto">There are no pending report share requests at this time.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {pendingRequests.map((request) => (
                        <div
                            key={request._id}
                            className="bg-surface-light dark:bg-surface-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="flex flex-col lg:flex-row gap-6">
                                {/* Requester Info */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg">
                                            {request.userId?.profile?.firstName?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-text-primary-light dark:text-text-primary-dark truncate">
                                                {request.userId?.profile?.firstName} {request.userId?.profile?.lastName}
                                            </h4>
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Requested Share for:</p>
                                            <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                                                {request.targetUserId?.profile?.firstName} {request.targetUserId?.profile?.lastName}
                                            </p>
                                            <p className="text-xs text-text-secondary-light font-bold flex items-center gap-1">
                                                <Clock size={12} /> Requested {formatIST(new Date(request.createdAt).getTime(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border-light dark:border-border-dark">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest">
                                                {request.hasSecondRecipient ? 'Primary Recipient' : 'Recipient'}
                                            </label>
                                            <div className="flex items-center gap-2 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                                                <Mail size={14} className="text-primary" />
                                                <span>{request.recipientName} ({request.recipientEmail})</span>
                                            </div>
                                        </div>

                                        {request.hasSecondRecipient && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest">Secondary Recipient</label>
                                                <div className="flex items-center gap-2 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                                                    <Mail size={14} className="text-primary" />
                                                    <span>{request.recipient2Name} ({request.recipient2Email})</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest">Report Period</label>
                                            <div className="flex items-center gap-2 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                                                <Calendar size={14} className="text-primary" />
                                                <span>{request.startDate} to {request.endDate}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {(request.automateWeekly || request.automateMonthly) && (
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full border border-emerald-200 dark:border-emerald-800">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                                                Includes {request.automateWeekly ? 'Weekly' : ''}{request.automateWeekly && request.automateMonthly ? ' & ' : ''}{request.automateMonthly ? 'Monthly' : ''} Automation
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-row lg:flex-col gap-2 justify-center lg:justify-start lg:min-w-[180px]">
                                    <button
                                        onClick={() => handlePreview(request)}
                                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark font-extrabold text-xs uppercase tracking-widest hover:bg-primary/5 hover:border-primary/30 transition-all"
                                    >
                                        <Eye size={16} />
                                        <span>View Report</span>
                                    </button>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(request._id)}
                                            disabled={isProcessing === request._id}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            <Check size={16} />
                                            <span className="lg:hidden xl:inline">Approve</span>
                                        </button>
                                        <button
                                            onClick={() => handleReject(request._id)}
                                            disabled={isProcessing === request._id}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-red-200 dark:border-red-800/50 text-red-500 dark:text-red-400 font-black text-xs uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            <X size={16} />
                                            <span className="lg:hidden xl:inline">Reject</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {requests.some(r => r.status !== 'PENDING') && (
                <div className="pt-8 border-t border-border-light dark:border-border-dark mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-text-secondary-light" />
                            <h4 className="text-sm font-black text-text-secondary-light uppercase tracking-widest">
                                Recently Processed ({requests.filter(r => r.status !== 'PENDING').length})
                            </h4>
                        </div>
                        <button
                            onClick={handleClearHistory}
                            disabled={!!isProcessing}
                            className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-widest flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all disabled:opacity-50"
                        >
                            <Trash2 size={12} />
                            Clear History
                        </button>
                    </div>
                    <div className="space-y-3">
                        {requests.filter(r => r.status !== 'PENDING').slice(0, 15).map(request => (
                            <div key={request._id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark text-xs font-bold gap-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl flex-shrink-0 ${request.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                        {request.status === 'APPROVED' ? <Check size={14} /> : <X size={14} />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-text-primary-light dark:text-text-primary-dark font-black">
                                                {request.userId?.profile?.firstName} {request.userId?.profile?.lastName}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${request.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                                                {request.status}
                                            </span>
                                        </div>
                                        <p className="text-text-secondary-light dark:text-text-secondary-dark truncate mt-0.5">
                                            Shared report for <span className="text-primary">{request.targetUserId?.profile?.firstName}</span> with {request.recipientEmail}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between md:justify-end gap-4 ml-11 md:ml-0">
                                    <span className="text-text-secondary-light font-bold flex items-center gap-1">
                                        <Calendar size={12} />
                                        {formatIST(new Date(request.createdAt).getTime(), { month: 'short', day: 'numeric' })}
                                    </span>
                                    <button
                                        onClick={() => {
                                            appLogger.info('[ReportApprovalPanel] Requesting delete for:', request._id);
                                            handleDelete(request._id);
                                        }}
                                        disabled={!!isProcessing}
                                        className="p-2 rounded-xl border border-red-200 dark:border-red-800/50 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all disabled:opacity-50"
                                        title="Delete this request"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportApprovalPanel;
