import api from '../api';
import { IAttendanceAttemptLog } from '../types';

/**
 * Get analytics data for a user
 */
export const getMyAnalytics = async (params: {
    startDate: string;
    endDate: string;
    classId: string;
    userId?: string;
}) => {
    const { userId, ...rest } = params;
    const response = await api.get('/api/attendance/my-analytics', {
        params: userId ? { ...rest, userId } : rest,
    });
    return response.data.data;
};

export interface AttendanceDashboardParams {
    startDate?: string;
    endDate?: string;
    classId: string;
    userId?: string;
}

export const getMyDashboard = async (params: AttendanceDashboardParams) => {
    const { userId, ...rest } = params;
    const response = await api.get('/api/attendance/my-dashboard', {
        params: userId ? { ...rest, userId } : rest,
    });
    return response.data.data;
};

/**
 * Get list of sessions/classes a user is enrolled in
 */
export const getMySessions = async (userId?: string) => {
    const response = await api.get('/api/attendance/my-sessions', {
        params: userId ? { userId } : undefined,
    });
    return response.data.data;
};

export interface AttendanceAttemptQuery {
    classId?: string;
    sessionId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    method?: string;
    userId?: string;
    page?: number;
    limit?: number;
    date?: string;
}

export interface AttendanceAttemptListResponse {
    attempts: IAttendanceAttemptLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export const getMyAttendanceAttempts = async (
    params: AttendanceAttemptQuery,
): Promise<AttendanceAttemptListResponse> => {
    const response = await api.get('/api/attendance/my-attempts', { params });
    return response.data;
};

export const getSessionAttendanceAttempts = async (
    sessionId: string,
    params: AttendanceAttemptQuery,
): Promise<AttendanceAttemptListResponse> => {
    const response = await api.get(`/api/attendance/session/${sessionId}/attempts`, { params });
    return response.data;
};
