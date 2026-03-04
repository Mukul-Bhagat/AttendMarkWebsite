import api from '../api';

export interface CreateAttendanceIssuePayload {
    classId: string;
    sessionDate: string;
    sessionInstanceId?: string;
    issueType?: 'CHECK_IN' | 'CHECK_OUT' | 'STATUS_CORRECTION' | 'MISSED_MARK' | 'OTHER';
    reason: string;
    requestedStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE' | 'HALF_DAY';
    requestedCheckInAt?: string;
    requestedCheckOutAt?: string;
    requestedNote?: string;
}

export const createAttendanceIssue = async (payload: CreateAttendanceIssuePayload) => {
    const response = await api.post('/api/attendance/issues', payload);
    return response.data.data;
};

export const getMyAttendanceIssues = async (status?: 'PENDING' | 'APPROVED' | 'REJECTED') => {
    const response = await api.get('/api/attendance/issues/my', {
        params: status ? { status } : undefined,
    });
    return response.data.data || [];
};

export const getAttendanceIssueQueue = async (status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' = 'PENDING') => {
    const response = await api.get('/api/attendance/issues/queue', {
        params: status === 'ALL' ? undefined : { status },
    });
    return response.data.data || [];
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
