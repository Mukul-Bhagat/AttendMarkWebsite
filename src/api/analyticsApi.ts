import api from '../api';

/**
 * Get analytics data for a user
 */
export const getMyAnalytics = async (params: {
    startDate: string;
    endDate: string;
    sessionId?: string;
    userId?: string;
}) => {
    const { userId, ...rest } = params;
    const endpoint = userId ? `/api/attendance/user/${userId}/analytics` : '/api/attendance/my-analytics';
    const response = await api.get(endpoint, { params: rest });
    return response.data.data;
};

/**
 * Get list of sessions/classes a user is enrolled in
 */
export const getMySessions = async (userId?: string) => {
    const endpoint = userId ? `/api/attendance/user/${userId}/sessions` : '/api/attendance/my-sessions';
    const response = await api.get(endpoint);
    return response.data.data;
};
