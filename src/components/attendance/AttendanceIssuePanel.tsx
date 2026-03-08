import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Eye,
    ShieldCheck,
    XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
    AttendanceIssueDto,
    AttendanceIssueStatus,
    IssueWorkflowStatus,
    approveAttendanceIssue,
    createAttendanceIssue,
    getAttendanceIssueQueue,
    getMyAttendanceIssues,
    rejectAttendanceIssue,
} from '../../api/attendanceIssuesApi';

interface AttendanceIssuePanelProps {
    isOpen: boolean;
    onClose: () => void;
    classId: string;
    classes: Array<{ _id: string; name: string }>;
    onClassChange: (classId: string) => void;
    defaultSessionDate: string;
    canReview: boolean;
    onIssueUpdated?: () => void;
}

type QueueFilter = IssueWorkflowStatus | 'ALL';

const statusBadge = (status: IssueWorkflowStatus) => {
    if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'REJECTED') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
};

const formatWorkflowStatus = (status: IssueWorkflowStatus): string => {
    if (status === 'APPROVED') return 'Approved';
    if (status === 'REJECTED') return 'Rejected';
    return 'Pending';
};

const formatAttendanceStatus = (status?: AttendanceIssueStatus): string => {
    if (status === 'LEAVE_APPROVED' || status === 'ON_LEAVE') return 'Leave (Approved)';
    if (status === 'HALF_DAY') return 'Half Day';
    if (status === 'LATE') return 'Late';
    if (status === 'PRESENT') return 'Present';
    return 'Absent';
};

const formatTimestamp = (value?: string): string => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
};

const toInitials = (name: string): string => {
    const tokens = name
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean)
        .slice(0, 2);
    if (tokens.length === 0) return 'U';
    return tokens.map((token) => token[0]?.toUpperCase() || '').join('');
};

const resolveRequesterName = (issue: AttendanceIssueDto): string => {
    if (issue.requesterName && issue.requesterName.trim().length > 0) {
        return issue.requesterName.trim();
    }
    const first = issue.requesterUserId?.profile?.firstName?.trim() || '';
    const last = issue.requesterUserId?.profile?.lastName?.trim() || '';
    const full = `${first} ${last}`.trim();
    if (full) return full;
    if (issue.requesterEmail?.trim()) return issue.requesterEmail.trim();
    return issue.requesterUserId?.email || 'Unknown User';
};

const resolveRequesterEmail = (issue: AttendanceIssueDto): string => {
    if (issue.requesterEmail && issue.requesterEmail.trim().length > 0) {
        return issue.requesterEmail.trim();
    }
    return issue.requesterUserId?.email || '';
};

const resolveRequesterAvatar = (issue: AttendanceIssueDto): string | null => {
    return (
        issue.requesterAvatar ||
        issue.requesterUserId?.profile?.avatarUrl ||
        issue.requesterUserId?.profileImageUrl ||
        issue.requesterUserId?.profilePicture ||
        null
    );
};

const resolveReviewerName = (issue: AttendanceIssueDto): string => {
    if (issue.decidedByName && issue.decidedByName.trim().length > 0) {
        return issue.decidedByName.trim();
    }
    const first = issue.decidedByUserId?.profile?.firstName?.trim() || '';
    const last = issue.decidedByUserId?.profile?.lastName?.trim() || '';
    const full = `${first} ${last}`.trim();
    if (full) return full;
    return issue.decidedByUserId?.email || 'Reviewer';
};

const AttendanceIssuePanel: React.FC<AttendanceIssuePanelProps> = ({
    isOpen,
    onClose,
    classId,
    classes,
    onClassChange,
    defaultSessionDate,
    canReview,
    onIssueUpdated,
}) => {
    const [tab, setTab] = useState<'raise' | 'my' | 'queue'>('raise');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingMy, setLoadingMy] = useState(false);
    const [loadingQueue, setLoadingQueue] = useState(false);
    const [myIssues, setMyIssues] = useState<AttendanceIssueDto[]>([]);
    const [queueIssues, setQueueIssues] = useState<AttendanceIssueDto[]>([]);
    const [queueFilter, setQueueFilter] = useState<QueueFilter>('PENDING');
    const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

    const [sessionDate, setSessionDate] = useState(defaultSessionDate);
    const [requestedStatus, setRequestedStatus] = useState<AttendanceIssueStatus>('PRESENT');
    const [reason, setReason] = useState('');
    const [requestedCheckInAt, setRequestedCheckInAt] = useState('');
    const [requestedCheckOutAt, setRequestedCheckOutAt] = useState('');

    useEffect(() => {
        setSessionDate(defaultSessionDate);
    }, [defaultSessionDate]);

    useEffect(() => {
        if (!classId && classes.length > 0) {
            onClassChange(classes[0]._id);
        }
    }, [classId, classes, onClassChange]);

    const fetchMyIssues = useCallback(async () => {
        setLoadingMy(true);
        try {
            const data = await getMyAttendanceIssues();
            setMyIssues(Array.isArray(data) ? data : []);
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.response?.data?.msg || 'Failed to load issues');
        } finally {
            setLoadingMy(false);
        }
    }, []);

    const fetchQueueIssues = useCallback(async () => {
        if (!canReview) return;
        setLoadingQueue(true);
        try {
            const data = await getAttendanceIssueQueue(queueFilter);
            setQueueIssues(Array.isArray(data) ? data : []);
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.response?.data?.msg || 'Failed to load review queue');
        } finally {
            setLoadingQueue(false);
        }
    }, [canReview, queueFilter]);

    useEffect(() => {
        if (!isOpen) return;
        fetchMyIssues();
        if (canReview) {
            fetchQueueIssues();
        }
    }, [isOpen, canReview, fetchMyIssues, fetchQueueIssues]);

    useEffect(() => {
        if (!isOpen || !canReview) return;
        fetchQueueIssues();
    }, [queueFilter, isOpen, canReview, fetchQueueIssues]);

    const resetForm = () => {
        setReason('');
        setRequestedStatus('PRESENT');
        setRequestedCheckInAt('');
        setRequestedCheckOutAt('');
        setExpandedIssueId(null);
    };

    const handleCreateIssue = async () => {
        if (!classId) {
            toast.error('Please select class first');
            return;
        }
        if (!sessionDate) {
            toast.error('Session date is required');
            return;
        }
        if (!reason.trim() || reason.trim().length < 5) {
            toast.error('Reason must be at least 5 characters');
            return;
        }

        setIsSubmitting(true);
        try {
            await createAttendanceIssue({
                classId,
                sessionDate,
                reason: reason.trim(),
                requestedStatus,
                requestedCheckInAt: requestedCheckInAt || undefined,
                requestedCheckOutAt: requestedCheckOutAt || undefined,
            });
            toast.success('Attendance issue submitted');
            resetForm();
            await fetchMyIssues();
            onIssueUpdated?.();
            setTab('my');
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.response?.data?.msg || 'Failed to create issue');
        } finally {
            setIsSubmitting(false);
        }
    };

    const queueEmptyMessage = useMemo(() => {
        if (queueFilter === 'ALL') return 'No issue history available.';
        return `No ${queueFilter.toLowerCase()} issues in queue.`;
    }, [queueFilter]);

    const toggleIssueDetails = (issueId: string) => {
        setExpandedIssueId((current) => (current === issueId ? null : issueId));
    };

    const handleApprove = async (issueId: string) => {
        const approvalNote = window.prompt('Approval note (optional):') || undefined;
        try {
            await approveAttendanceIssue(issueId, approvalNote);
            toast.success('Issue approved and attendance updated');
            await Promise.all([fetchQueueIssues(), fetchMyIssues()]);
            onIssueUpdated?.();
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.response?.data?.msg || 'Approval failed');
        }
    };

    const handleReject = async (issueId: string) => {
        const rejectionReason = window.prompt('Rejection reason (minimum 5 chars):');
        if (!rejectionReason || rejectionReason.trim().length < 5) {
            toast.error('Rejection reason must be at least 5 characters');
            return;
        }
        try {
            await rejectAttendanceIssue(issueId, rejectionReason.trim());
            toast.success('Issue rejected');
            await Promise.all([fetchQueueIssues(), fetchMyIssues()]);
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.response?.data?.msg || 'Rejection failed');
        }
    };

    const renderIssueCard = (
        issue: AttendanceIssueDto,
        options: { canReviewActions?: boolean },
    ) => {
        const requesterName = resolveRequesterName(issue);
        const requesterEmail = resolveRequesterEmail(issue);
        const requesterAvatar = resolveRequesterAvatar(issue);
        const requestedAt = issue.requestedAt || issue.createdAt;
        const isExpanded = expandedIssueId === issue._id;

        return (
            <div
                key={issue._id}
                className="rounded-2xl border border-border-light dark:border-border-dark p-4 bg-background-light/40 dark:bg-background-dark/50"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center overflow-hidden font-bold text-xs flex-shrink-0">
                            {requesterAvatar ? (
                                <img
                                    src={requesterAvatar}
                                    alt={requesterName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span>{toInitials(requesterName)}</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-black text-text-primary-light dark:text-text-primary-dark truncate">
                                {requesterName}
                            </p>
                            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate">
                                {requesterEmail || 'No email snapshot'}
                            </p>
                            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                                Date: {issue.sessionDateKey || 'N/A'}
                            </p>
                        </div>
                    </div>
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${statusBadge(issue.status)}`}>
                        {formatWorkflowStatus(issue.status)}
                    </span>
                </div>

                <p className="mt-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    {issue.reason || 'No reason provided'}
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-background-light dark:bg-background-dark p-2">
                        <p className="font-bold text-text-secondary-light">Current</p>
                        <p className="text-text-primary-light dark:text-text-primary-dark">
                            {formatAttendanceStatus(issue.currentSnapshot?.status)}
                        </p>
                    </div>
                    <div className="rounded-lg bg-background-light dark:bg-background-dark p-2">
                        <p className="font-bold text-text-secondary-light">Requested</p>
                        <p className="text-text-primary-light dark:text-text-primary-dark">
                            {formatAttendanceStatus(issue.requestedCorrection?.status)}
                        </p>
                    </div>
                    <div className="rounded-lg bg-background-light dark:bg-background-dark p-2">
                        <p className="font-bold text-text-secondary-light">Requested At</p>
                        <p className="text-text-primary-light dark:text-text-primary-dark">
                            {formatTimestamp(requestedAt)}
                        </p>
                    </div>
                </div>

                {isExpanded && (
                    <div className="mt-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light/70 dark:bg-background-dark/70 p-3 text-xs space-y-2">
                        <p className="text-text-secondary-light dark:text-text-secondary-dark">
                            <span className="font-bold text-text-primary-light dark:text-text-primary-dark">Request ID:</span>{' '}
                            {issue._id}
                        </p>
                        {issue.status !== 'PENDING' && (
                            <>
                                <p className="text-text-secondary-light dark:text-text-secondary-dark">
                                    <span className="font-bold text-text-primary-light dark:text-text-primary-dark">Reviewed By:</span>{' '}
                                    {resolveReviewerName(issue)}
                                </p>
                                <p className="text-text-secondary-light dark:text-text-secondary-dark">
                                    <span className="font-bold text-text-primary-light dark:text-text-primary-dark">Reviewed At:</span>{' '}
                                    {formatTimestamp(issue.decidedAt)}
                                </p>
                            </>
                        )}
                        {issue.approvalNote && issue.approvalNote.trim().length > 0 && (
                            <p className="text-emerald-700 dark:text-emerald-400">
                                <span className="font-bold">Approval Note:</span> {issue.approvalNote}
                            </p>
                        )}
                        {issue.rejectionReason && issue.rejectionReason.trim().length > 0 && (
                            <p className="text-red-700 dark:text-red-400">
                                <span className="font-bold">Rejection Reason:</span> {issue.rejectionReason}
                            </p>
                        )}
                    </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                    {options.canReviewActions && issue.status === 'PENDING' && (
                        <>
                            <button
                                onClick={() => handleApprove(issue._id)}
                                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <CheckCircle2 size={16} />
                                Approve
                            </button>
                            <button
                                onClick={() => handleReject(issue._id)}
                                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <XCircle size={16} />
                                Reject
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => toggleIssueDetails(issue._id)}
                        className="h-10 px-4 rounded-xl border border-border-light dark:border-border-dark text-sm font-bold text-text-primary-light dark:text-text-primary-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors flex items-center justify-center gap-2"
                    >
                        <Eye size={16} />
                        {isExpanded ? 'Hide' : 'View'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={`fixed inset-0 z-[80] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div
                className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <aside className={`absolute right-0 top-0 h-full w-full max-w-xl bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark shadow-2xl transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full flex flex-col">
                    <div className="px-6 py-5 border-b border-border-light dark:border-border-dark bg-gradient-to-r from-[#fff4ef] to-white dark:from-slate-900 dark:to-slate-900">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-text-primary-light dark:text-text-primary-dark">Attendance Issue Center</h2>
                                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">Raise request, track status, and review approvals</p>
                            </div>
                            <button onClick={onClose} className="h-10 w-10 rounded-xl border border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <button
                                onClick={() => setTab('raise')}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'raise' ? 'bg-primary text-white shadow' : 'bg-background-light dark:bg-background-dark text-text-secondary-light dark:text-text-secondary-dark'}`}
                            >
                                Raise Issue
                            </button>
                            <button
                                onClick={() => setTab('my')}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'my' ? 'bg-primary text-white shadow' : 'bg-background-light dark:bg-background-dark text-text-secondary-light dark:text-text-secondary-dark'}`}
                            >
                                My Requests
                            </button>
                            {canReview && (
                                <button
                                    onClick={() => setTab('queue')}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'queue' ? 'bg-primary text-white shadow' : 'bg-background-light dark:bg-background-dark text-text-secondary-light dark:text-text-secondary-dark'}`}
                                >
                                    Review Queue
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                        {tab === 'raise' && (
                            <div className="space-y-4 animate-in slide-in-from-right-3 duration-300">
                                <label className="block">
                                    <span className="text-xs font-black uppercase tracking-wider text-text-secondary-light">Class / Batch</span>
                                    <select
                                        value={classId}
                                        onChange={(e) => onClassChange(e.target.value)}
                                        disabled={classes.length === 0}
                                        className="mt-2 w-full px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {classes.length === 0 && <option value="">No enrolled classes</option>}
                                        {classes.map((classBatch) => (
                                            <option key={classBatch._id} value={classBatch._id}>
                                                {classBatch.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-wider text-text-secondary-light">Session Date</span>
                                        <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark" />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-wider text-text-secondary-light">Requested Status</span>
                                        <select value={requestedStatus} onChange={(e) => setRequestedStatus(e.target.value as AttendanceIssueStatus)} className="mt-2 w-full px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark">
                                            <option value="PRESENT">Present</option>
                                            <option value="LATE">Late</option>
                                            <option value="HALF_DAY">Half Day</option>
                                            <option value="ABSENT">Absent</option>
                                            <option value="LEAVE_APPROVED">Leave (Approved)</option>
                                        </select>
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-wider text-text-secondary-light">Requested Check-In</span>
                                        <input type="datetime-local" value={requestedCheckInAt} onChange={(e) => setRequestedCheckInAt(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark" />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-black uppercase tracking-wider text-text-secondary-light">Requested Check-Out</span>
                                        <input type="datetime-local" value={requestedCheckOutAt} onChange={(e) => setRequestedCheckOutAt(e.target.value)} className="mt-2 w-full px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark" />
                                    </label>
                                </div>
                                <label className="block">
                                    <span className="text-xs font-black uppercase tracking-wider text-text-secondary-light">Reason</span>
                                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={5} placeholder="Explain what should be corrected and why." className="mt-2 w-full px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark" />
                                </label>
                                <button
                                    onClick={handleCreateIssue}
                                    disabled={isSubmitting}
                                    className="w-full h-11 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover transition-colors disabled:opacity-60"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Attendance Issue'}
                                </button>
                            </div>
                        )}

                        {tab === 'my' && (
                            <div className="space-y-3 animate-in slide-in-from-right-3 duration-300">
                                {loadingMy && <p className="text-sm text-text-secondary-light">Loading requests...</p>}
                                {!loadingMy && myIssues.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-border-light dark:border-border-dark p-6 text-sm text-text-secondary-light">
                                        No attendance issues raised yet.
                                    </div>
                                )}
                                {myIssues.map((issue) => renderIssueCard(issue, { canReviewActions: false }))}
                            </div>
                        )}

                        {tab === 'queue' && canReview && (
                            <div className="space-y-3 animate-in slide-in-from-right-3 duration-300">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-text-secondary-light">Review Filter</h3>
                                    <select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value as QueueFilter)} className="px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm">
                                        <option value="PENDING">Pending</option>
                                        <option value="APPROVED">Approved</option>
                                        <option value="REJECTED">Rejected</option>
                                        <option value="ALL">All</option>
                                    </select>
                                </div>
                                {loadingQueue && <p className="text-sm text-text-secondary-light">Loading queue...</p>}
                                {!loadingQueue && queueIssues.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-border-light dark:border-border-dark p-6 text-sm text-text-secondary-light">
                                        {queueEmptyMessage}
                                    </div>
                                )}
                                {queueIssues.map((issue) => renderIssueCard(issue, { canReviewActions: true }))}
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t border-border-light dark:border-border-dark bg-background-light/70 dark:bg-background-dark/60">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-semibold text-text-secondary-light">
                            <div className="flex items-center gap-1"><Clock3 size={14} /> Pending</div>
                            <div className="flex items-center gap-1"><CheckCircle2 size={14} /> Approved</div>
                            <div className="flex items-center gap-1"><AlertTriangle size={14} /> Rejected</div>
                            <div className="flex items-center gap-1"><ShieldCheck size={14} /> Audit Logged</div>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default AttendanceIssuePanel;
