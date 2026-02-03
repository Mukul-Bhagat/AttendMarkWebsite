/**
 * ============================================================================
 * ATTENDANCE ADJUSTMENT API
 * ============================================================================
 * 
 * API client for append-only attendance adjustment system
 * 
 * Security: All calls require JWT token with CompanyAdmin or PLATFORM_OWNER role
 * Backend enforces: Cross-org protection, age limits, validation
 * Frontend ensures: Permission checks, input validation, error handling
 * 
 * ============================================================================
 */

import api from '../api';

const API_BASE = '/api/attendance';

export interface AdjustAttendancePayload {
    userId: string;
    newStatus: 'PRESENT' | 'ABSENT' | 'LATE';
    reason: string; // Required: 10-500 chars
    lateMinutes?: number; // Required if newStatus = 'LATE'
    targetDate?: string; // Required for recurring sessions (ISO date string)
}

export interface AdjustAttendanceResponse {
    success: boolean;
    message: string;
    modification: {
        userId: string;
        userName: string;
        previousStatus: string;
        newStatus: string;
        modifiedBy: {
            userId: string;
            name: string;
            role: string;
        };
        modifiedAt: string;
        reason: string;
    };
    attendanceSummary: {
        total: number;
        present: number;
        absent: number;
        late: number;
    };
}

export interface AttendanceModification {
    modifiedAt: string;
    modifiedBy: {
        userId: string;
        name: string;
        role: string;
    };
    action: string;
    reason: string;
    previousState: {
        status: string;
        markedAt?: string;
        lateMinutes?: number;
    };
    newState: {
        status: string;
        markedAt?: string;
        lateMinutes?: number;
    };
}

export interface AttendanceAuditEntry {
    timestamp: string;
    modifiedBy: {
        userId: string;
        name: string;
        role: string;
    };
    userId: string;
    userName: string;
    action: string;
    reason: string;
    changeType: string;
}

/**
 * Adjust attendance for a user in a session (APPEND-ONLY)
 * 
 * @param sessionId - Session ID
 * @param payload - Adjustment payload
 * @returns Promise with adjustment confirmation
 * 
 * @throws {AxiosError} If backend validation fails or permission denied
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await adjustAttendance('session_123', {
 *     userId: 'user_456',
 *     newStatus: 'PRESENT',
 *     reason: 'Student forgot to scan QR code',
 *   });
 *   console.log('Adjusted:', result.modification);
 * } catch (error) {
 *   console.error('Failed:', error.response?.data?.message);
 * }
 * ```
 */
export const adjustAttendance = async (
    sessionId: string,
    payload: AdjustAttendancePayload
): Promise<AdjustAttendanceResponse> => {
    const response = await api.post<AdjustAttendanceResponse>(
        `${API_BASE}/session/${sessionId}/adjust`,
        payload
    );
    return response.data;
};

/**
 * Get detailed session attendance with modification history
 * 
 * @param sessionId - Session ID
 * @param includeHistory - Whether to include full modification history
 * @returns Promise with detailed attendance data
 */
export const getDetailedSessionAttendance = async (
    sessionId: string,
    includeHistory: boolean = false
): Promise<any> => {
    const response = await api.get(
        `${API_BASE}/session/${sessionId}/detailed`,
        {
            params: { includeHistory }
        }
    );
    return response.data;
};

/**
 * Get session-level audit trail
 * 
 * @param sessionId - Session ID
 * @param targetDate - Optional date filter (ISO string)
 * @returns Promise with audit trail entries
 */
export const getSessionAuditTrail = async (
    sessionId: string,
    targetDate?: string
): Promise<AttendanceAuditEntry[]> => {
    const response = await api.get(
        `${API_BASE}/session/${sessionId}/audit`,
        {
            params: { targetDate }
        }
    );
    return response.data.auditLog || [];
};

/**
 * Get user's modification history for a specific session
 * 
 * @param sessionId - Session ID
 * @param userId - User ID
 * @param targetDate - Optional date filter
 * @returns Promise with modification history
 */
export const getUserModificationHistory = async (
    sessionId: string,
    userId: string,
    targetDate?: string
): Promise<AttendanceModification[]> => {
    const response = await api.get(
        `${API_BASE}/session/${sessionId}/user/${userId}/history`,
        {
            params: { targetDate }
        }
    );
    return response.data.modificationHistory || [];
};

/**
 * Validate adjustment payload (frontend pre-check)
 * 
 * @param payload - Adjustment payload
 * @returns { valid: boolean, errors: string[] }
 */
export const validateAdjustmentPayload = (
    payload: AdjustAttendancePayload
): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate userId
    if (!payload.userId || payload.userId.trim().length === 0) {
        errors.push('User ID is required');
    }

    // Validate newStatus
    if (!['PRESENT', 'ABSENT', 'LATE'].includes(payload.newStatus)) {
        errors.push('Invalid status. Must be PRESENT, ABSENT, or LATE');
    }

    // Validate reason
    const reasonLength = payload.reason?.trim().length || 0;
    if (reasonLength < 10) {
        errors.push('Reason must be at least 10 characters');
    }
    if (reasonLength > 500) {
        errors.push('Reason must not exceed 500 characters');
    }

    // Validate lateMinutes for LATE status
    if (payload.newStatus === 'LATE') {
        if (!payload.lateMinutes || payload.lateMinutes < 1) {
            errors.push('Late minutes must be greater than 0 when marking as LATE');
        }
        if (payload.lateMinutes && payload.lateMinutes > 180) {
            errors.push('Late minutes cannot exceed 180 minutes (3 hours)');
        }
    }

    // Validate targetDate format if provided
    if (payload.targetDate) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(payload.targetDate)) {
            errors.push('Target date must be in YYYY-MM-DD format');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Format modification history for display
 * 
 * @param history - Modification history array
 * @returns Formatted history for UI
 */
export const formatModificationHistory = (
    history: AttendanceModification[]
): Array<{
    timestamp: string;
    admin: string;
    action: string;
    reason: string;
    statusChange: string;
}> => {
    return history.map(entry => ({
        timestamp: new Date(entry.modifiedAt).toLocaleString('en-IN', {
            dateStyle: 'short',
            timeStyle: 'short'
        }),
        admin: `${entry.modifiedBy.name} (${entry.modifiedBy.role})`,
        action: entry.action.replace('MARKED_', '').replace('_', ' '),
        reason: entry.reason,
        statusChange: `${entry.previousState.status} → ${entry.newState.status}`
    }));
};

/**
 * Export audit trail to CSV
 * 
 * @param sessionId - Session ID
 * @param sessionName - Session name for filename
 */
export const exportAuditTrailCSV = async (
    sessionId: string,
    sessionName: string
): Promise<void> => {
    const auditLog = await getSessionAuditTrail(sessionId);

    const csvHeaders = [
        'Date/Time',
        'Student',
        'Action',
        'Reason',
        'Modified By',
        'Role'
    ];

    const csvRows = auditLog.map(entry => [
        new Date(entry.timestamp).toLocaleString('en-IN'),
        entry.userName,
        entry.action,
        `"${entry.reason.replace(/"/g, '""')}"`, // Escape quotes
        entry.modifiedBy.name,
        entry.modifiedBy.role
    ]);

    const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${sessionName}_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
