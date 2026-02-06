import api from '../api';

export interface ShareReportOptions {
    recipientName: string;
    recipientEmail: string;
    recipientGender: string;
    recipientRole?: string;
    hasSecondRecipient?: boolean;
    recipient2Name?: string;
    recipient2Email?: string;
    recipient2Gender?: string;
    recipient2Role?: string;
    organizationName?: string;
    organizationLogo?: string;
    startDate: string;
    endDate: string;
    automateWeekly?: boolean;
    preferredWeekday?: string;
    preferredTime?: string;
    automateMonthly?: boolean;
    monthlySchedule?: string;
    monthlyTime?: string;
    userId?: string;
}

export interface DownloadReportOptions {
    startDate: string;
    endDate: string;
    organizationName?: string;
    organizationLogo?: string;
    reportType?: string;
    format?: 'pdf' | 'excel';
    userId?: string;
}

export interface ReportShareRequest {
    _id: string;
    userId: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
        profile?: any;
    };
    recipientName: string;
    recipientEmail: string;
    recipientGender: string;
    startDate: string;
    endDate: string;
    organizationName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    automateWeekly: boolean;
    automateMonthly: boolean;
    createdAt: string;
    targetUserId: {
        _id: string;
        email: string;
        profile: {
            firstName: string;
            lastName: string;
        };
    };
    organizationLogo?: string;
    hasSecondRecipient: boolean;
    recipient2Name?: string;
    recipient2Email?: string;
    recipient2Gender?: string;
    recipient2Role?: string;
    preferredWeekday?: string;
    preferredTime?: string;
    monthlySchedule?: string;
    monthlyTime?: string;
    automationId?: string;
}

export const shareAttendanceReport = async (options: ShareReportOptions) => {
    return await api.post('/api/attendance/share', options);
};

export const downloadAttendanceReport = async (options: DownloadReportOptions) => {
    return await api.post('/api/attendance/download', options, {
        responseType: 'blob',
    });
};

export const getReportShareRequests = async (status?: string) => {
    return await api.get(`/api/attendance/share-requests${status ? `?status=${status}` : ''}`);
};

export const approveReportShareRequest = async (id: string, adminNote?: string) => {
    return await api.put(`/api/attendance/share-requests/${id}/approve`, { adminNote });
};

export const rejectReportShareRequest = async (id: string, adminNote?: string) => {
    return await api.put(`/api/attendance/share-requests/${id}/reject`, { adminNote });
};

export const deleteReportShareRequest = async (id: string) => {
    return await api.delete(`/api/attendance/share-requests/${id}`);
};

export const clearReportShareRequestsHistory = async () => {
    return await api.delete('/api/attendance/share-requests/history/clear');
};

// Email Automation APIs
export const getEmailAutomationConfigs = async () => {
    return await api.get('/api/email-automation/configs');
};

export const toggleEmailAutomation = async (id: string) => {
    return await api.patch(`/api/email-automation/config/toggle/${id}`);
};

export const deleteEmailAutomation = async (id: string) => {
    return await api.delete(`/api/email-automation/config/${id}`);
};

