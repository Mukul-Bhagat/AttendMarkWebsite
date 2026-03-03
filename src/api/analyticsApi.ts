import api from '../api';

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

/**
 * Get list of sessions/classes a user is enrolled in
 */
export const getMySessions = async (userId?: string) => {
    const response = await api.get('/api/attendance/my-sessions', {
        params: userId ? { userId } : undefined,
    });
    return response.data.data;
};
