import api from '../api';

export type IssueWorkflowStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type AttendanceIssueStatus =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'LEAVE_APPROVED'
  | 'ON_LEAVE';

export interface CreateAttendanceIssuePayload {
    classId: string;
    sessionDate: string;
    sessionInstanceId?: string;
    issueType?: 'CHECK_IN' | 'CHECK_OUT' | 'STATUS_CORRECTION' | 'MISSED_MARK' | 'OTHER';
    reason: string;
    requestedStatus: AttendanceIssueStatus;
    requestedCheckInAt?: string;
    requestedCheckOutAt?: string;
    requestedNote?: string;
}

export interface AttendanceIssueDto {
    _id: string;
    status: IssueWorkflowStatus;
    reason: string;
    sessionDateKey: string;
    classBatchId?: string;
    requesterName?: string;
    requesterEmail?: string;
    requesterAvatar?: string | null;
    requesterUserId?: {
        _id?: string;
        email?: string;
        profile?: {
            firstName?: string;
            lastName?: string;
            avatarUrl?: string;
        };
        profileImageUrl?: string;
        profilePicture?: string;
    } | null;
    currentSnapshot?: {
        status?: AttendanceIssueStatus;
    };
    requestedCorrection?: {
        status?: AttendanceIssueStatus;
    };
    approvalNote?: string;
    rejectionReason?: string;
    decidedByName?: string;
    decidedAt?: string;
    decidedByUserId?: {
        _id?: string;
        email?: string;
        profile?: {
            firstName?: string;
            lastName?: string;
        };
    } | null;
    createdAt?: string;
    requestedAt?: string;
}

const normalizeIssueStatus = (value: unknown): AttendanceIssueStatus => {
    const token = String(value ?? '').trim().toUpperCase();
    if (token === 'LEAVE_APPROVED' || token === 'ON_LEAVE') return 'LEAVE_APPROVED';
    if (token === 'PRESENT') return 'PRESENT';
    if (token === 'LATE') return 'LATE';
    if (token === 'HALF_DAY') return 'HALF_DAY';
    return 'ABSENT';
};

const normalizeWorkflowStatus = (value: unknown): IssueWorkflowStatus => {
    const token = String(value ?? '').trim().toUpperCase();
    if (token === 'APPROVED') return 'APPROVED';
    if (token === 'REJECTED') return 'REJECTED';
    return 'PENDING';
};

const normalizeIssue = (issue: any): AttendanceIssueDto => ({
    _id: String(issue?._id || issue?.id || ''),
    status: normalizeWorkflowStatus(issue?.status),
    reason: String(issue?.reason || issue?.issueReason || ''),
    sessionDateKey: String(issue?.sessionDateKey || issue?.issueDate || ''),
    classBatchId: issue?.classBatchId ? String(issue.classBatchId) : undefined,
    requesterName: issue?.requesterName || issue?.userName || '',
    requesterEmail: issue?.requesterEmail || issue?.userEmail || '',
    requesterAvatar: issue?.requesterAvatar || issue?.userAvatar || null,
    requesterUserId: issue?.requesterUserId || null,
    currentSnapshot: {
        status: normalizeIssueStatus(issue?.currentSnapshot?.status || issue?.currentStatus),
    },
    requestedCorrection: {
        status: normalizeIssueStatus(issue?.requestedCorrection?.status || issue?.requestedStatus),
    },
    approvalNote: issue?.approvalNote || issue?.approvedNote || '',
    rejectionReason: issue?.rejectionReason || '',
    decidedByName: issue?.decidedByName || issue?.approvedByName || '',
    decidedAt: issue?.decidedAt || issue?.approvedAt || undefined,
    decidedByUserId: issue?.decidedByUserId || null,
    createdAt: issue?.createdAt || undefined,
    requestedAt: issue?.requestedAt || issue?.createdAt || undefined,
});

export const createAttendanceIssue = async (payload: CreateAttendanceIssuePayload) => {
    const normalizedPayload = {
        ...payload,
        requestedStatus:
            payload.requestedStatus === 'ON_LEAVE'
                ? 'LEAVE_APPROVED'
                : payload.requestedStatus,
    };
    const response = await api.post('/api/attendance/issues', normalizedPayload);
    return normalizeIssue(response.data.data || response.data);
};

export const getMyAttendanceIssues = async (status?: IssueWorkflowStatus) => {
    const response = await api.get('/api/attendance/issues/my', {
        params: status ? { status } : undefined,
    });
    const rows = Array.isArray(response.data.data) ? response.data.data : [];
    return rows.map(normalizeIssue);
};

export const getAttendanceIssueQueue = async (
    status: IssueWorkflowStatus | 'ALL' = 'PENDING',
) => {
    const response = await api.get('/api/attendance/issues/queue', {
        params: status === 'ALL' ? undefined : { status },
    });
    const rows = Array.isArray(response.data.data) ? response.data.data : [];
    return rows.map(normalizeIssue);
};

export const approveAttendanceIssue = async (issueId: string, approvalNote?: string) => {
    const response = await api.put(`/api/attendance/issues/${issueId}/approve`, {
        approvalNote,
    });
    return response.data;
};

export const rejectAttendanceIssue = async (issueId: string, rejectionReason: string) => {
    const response = await api.put(`/api/attendance/issues/${issueId}/reject`, {
        rejectionReason,
    });
    return response.data;
};
